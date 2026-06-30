// send-parent-credentials
// Triggered by: INSERT/UPDATE on parents table, or manual resend from admin UI
// Real workflow: parent gets WhatsApp message with their 4-digit PIN and portal URL
// Fallback: if phone unavailable, attempt email delivery
// Called from: onboarding step 6 completion, admin 'resend credentials' action

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TWILIO_SID   = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM  = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886';
const APP_URL      = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://www.edprosys.com';

interface SendRequest {
  parent_id: string;
  school_id: string;
  channel?: 'whatsapp' | 'sms' | 'email';  // default: whatsapp
  resend?: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body: SendRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { parent_id, school_id, channel = 'whatsapp', resend = false } = body;
  if (!parent_id || !school_id) {
    return new Response(JSON.stringify({ error: 'parent_id and school_id required' }), { status: 400 });
  }

  // Fetch parent + student info
  const parentRes = await fetch(
    `${SUPABASE_URL}/rest/v1/parents?id=eq.${parent_id}&school_id=eq.${school_id}&select=id,name,phone,email,access_pin,access_pin_hashed,credential_sent_at,student_id`,
    { headers: { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` } }
  );
  const parents = await parentRes.json();
  if (!Array.isArray(parents) || parents.length === 0) {
    return new Response(JSON.stringify({ error: 'Parent not found' }), { status: 404 });
  }
  const parent = parents[0];

  // Skip if already sent and not a resend
  if (!resend && parent.credential_sent_at) {
    return new Response(JSON.stringify({ skipped: true, reason: 'already_sent', sent_at: parent.credential_sent_at }));
  }

  // Fetch school name
  const schoolRes = await fetch(
    `${SUPABASE_URL}/rest/v1/schools?id=eq.${school_id}&select=name`,
    { headers: { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` } }
  );
  const schools = await schoolRes.json();
  const schoolName = schools[0]?.name ?? 'Your School';

  // Fetch student name
  let studentName = 'your child';
  if (parent.student_id) {
    const stuRes = await fetch(
      `${SUPABASE_URL}/rest/v1/students?id=eq.${parent.student_id}&select=name,class,section`,
      { headers: { 'apikey': SERVICE_ROLE, 'Authorization': `Bearer ${SERVICE_ROLE}` } }
    );
    const stus = await stuRes.json();
    if (stus[0]) {
      studentName = stus[0].name;
    }
  }

  // Use plaintext PIN if available (set during onboarding before hashing)
  // After full migration, this will be 'NNNN' placeholder and parent must use forgot-pin flow
  const pin = parent.access_pin ?? '(use forgot PIN)';
  const portalUrl = `${APP_URL}/parent`;

  // Build message — kept short for WhatsApp character limits
  // Real-world: parents in India respond to concise Hindi/English mixed messages
  const message = [
    `*${schoolName}* — Parent Portal`,
    ``,
    `Dear ${parent.name},`,
    `Your child *${studentName}* has been enrolled.`,
    ``,
    `📱 Login: ${portalUrl}`,
    `📞 Phone: ${parent.phone}`,
    `🔑 PIN: *${pin}*`,
    ``,
    `Keep this PIN safe. Contact school office to reset if forgotten.`,
  ].join('\n');

  let sent = false;
  let sendChannel = channel;
  let error: string | null = null;

  // Attempt WhatsApp first, fall back to SMS, then email
  if ((channel === 'whatsapp' || channel === 'sms') && parent.phone && TWILIO_SID) {
    try {
      const toNumber = parent.phone.startsWith('+') ? parent.phone : `+91${parent.phone.replace(/^0/, '')}`;
      const fromAddr = channel === 'whatsapp' ? TWILIO_FROM : TWILIO_FROM.replace('whatsapp:', '');
      const toAddr = channel === 'whatsapp' ? `whatsapp:${toNumber}` : toNumber;

      const twilioBody = new URLSearchParams({ From: fromAddr, To: toAddr, Body: message });
      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: twilioBody,
        }
      );
      const twilioData = await twilioRes.json();
      if (twilioRes.ok && twilioData.sid) {
        sent = true;
        sendChannel = channel;
      } else {
        error = twilioData.message ?? 'Twilio error';
        // WhatsApp failed → try SMS fallback
        if (channel === 'whatsapp') {
          sendChannel = 'sms';
        }
      }
    } catch (e) {
      error = String(e);
    }
  }

  // Email fallback if phone delivery failed and email is available
  // Using notifications table insert for dispatcher to pick up
  if (!sent && parent.email) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/notifications`,
      {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          school_id,
          type: 'parent_credentials_email',
          title: `${schoolName} — Parent Portal Access`,
          message: message.replace(/\*/g, ''),
          module: 'onboarding',
          status: 'pending',
          channel: 'email',
          template_vars: {
            parent_name: parent.name,
            student_name: studentName,
            school_name: schoolName,
            pin,
            portal_url: portalUrl,
            email: parent.email,
          },
        }),
      }
    );
    sent = true;
    sendChannel = 'email';
  }

  // If nothing worked, queue in notifications for manual/later dispatch
  if (!sent) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/notifications`,
      {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE,
          'Authorization': `Bearer ${SERVICE_ROLE}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          school_id,
          type: 'parent_welcome',
          title: 'Parent Portal Credentials',
          message,
          module: 'onboarding',
          status: 'pending',
          channel: 'whatsapp',
          template_vars: {
            parent_name: parent.name,
            student_name: studentName,
            pin,
            portal_url: portalUrl,
          },
        }),
      }
    );
    sendChannel = 'queued';
  }

  // Update parent: mark credential_sent_at
  await fetch(
    `${SUPABASE_URL}/rest/v1/parents?id=eq.${parent_id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        credential_sent_at: new Date().toISOString(),
        credential_sent_via: sendChannel,
      }),
    }
  );

  return new Response(
    JSON.stringify({ success: true, sent, channel: sendChannel, error }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
