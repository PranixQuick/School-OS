import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SCHOOL_ID = '00000000-0000-0000-0000-000000000001';
const SCHOOL_NAME_DEFAULT = 'Suchitra Academy';

// ─── Env vars ───────────────────────────────────────────────────────────────
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

// ─── Supabase client ─────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

// ─── Intent keyword maps ─────────────────────────────────────────────────────
const ATTENDANCE_KEYS = ['attendance','present','absent','aaya','attnd','bunk','missing','attending'];
const FEES_KEYS = ['fee','fees','pending','due','payment','pay','outstanding','amount','overdue','challan'];
const EVENTS_KEYS = ['event','events','holiday','exam','sports','ptm','meeting','test','schedule','upcoming','when'];

function detectIntent(msg: string): 'attendance' | 'fees' | 'events' | 'admission_inquiry' | 'unknown' {
  const lower = msg.toLowerCase();
  if (ATTENDANCE_KEYS.some(k => lower.includes(k))) return 'attendance';
  if (FEES_KEYS.some(k => lower.includes(k))) return 'fees';
  if (EVENTS_KEYS.some(k => lower.includes(k))) return 'events';
  // Admission keywords
  if (/admiss|enrol|enquir|apply|application|seat|eligib|class\s*\d|lkg|ukg|nursery|kinder|new\s*student|new\s*adm/i.test(lower)) return 'admission_inquiry';
  return 'unknown';
}

// ─── TwiML response ──────────────────────────────────────────────────────────
function twimlResponse(message: string): Response {
  const safe = message.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
  return new Response(xml, { headers: { 'Content-Type': 'text/xml; charset=utf-8' }, status: 200 });
}

// ─── Send WhatsApp via Twilio REST ───────────────────────────────────────────
async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return false;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const form = new URLSearchParams();
  form.append('From', TWILIO_WHATSAPP_FROM);
  form.append('To', to.startsWith('whatsapp:') ? to : `whatsapp:${to}`);
  form.append('Body', body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  return res.ok;
}

// ─── Knowledge retrieval ──────────────────────────────────────────────────────
async function getRelevantKnowledge(supabase: ReturnType<typeof getSupabase>, schoolId: string, question: string): Promise<string> {
  // Try text search first
  const { data: ftChunks } = await supabase
    .from('knowledge_chunks')
    .select('title, content, category')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .textSearch('content', question, { type: 'plain', config: 'english' })
    .limit(3);

  if (ftChunks?.length) {
    return ftChunks.map(c => `${c.title}: ${c.content}`).join('\n\n');
  }

  // Fallback: admission + fee + general chunks
  const { data: fallback } = await supabase
    .from('knowledge_chunks')
    .select('title, content, category')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .in('category', ['admission','fee_structure','fees','general'])
    .limit(3);

  return (fallback ?? []).map(c => `${c.title}: ${c.content}`).join('\n\n');
}

// ─── AI admission counselor ───────────────────────────────────────────────────
async function generateCounselorResponse(schoolName: string, context: string, message: string, history: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return `Thank you for your interest in ${schoolName}! Please call us or visit the school for admission details.`;
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{ role: 'user', content:
          `You are an admission counselor for ${schoolName}.\nAnswer the parent\'s WhatsApp message using ONLY the context below.\nBe warm, concise (max 3 sentences). End with a clear next step.\nIf you don\'t know, say to call the school directly.\n\nSchool context:\n${context || 'No specific information available.'}\n\n${history ? `Conversation so far:\n${history}\n` : ''}Parent message: ${message}\n\nReply in the same language as the parent\'s message.`
        }],
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? `Thank you! Please contact ${schoolName} for more details.`;
  } catch (e) {
    console.warn('[Counselor] Claude error:', String(e).slice(0,80));
    return `Thank you for your interest in ${schoolName}! Please call us for admission details.`;
  }
}

// ─── Existing bot: attendance handler ────────────────────────────────────────
async function handleAttendance(supabase: ReturnType<typeof getSupabase>, phone: string, schoolId: string, schoolName: string): Promise<string> {
  const normalizedPhone = phone.replace('whatsapp:', '');
  const { data: students } = await supabase
    .from('students').select('id, name, class, section')
    .eq('school_id', schoolId).eq('phone_parent', normalizedPhone).eq('is_active', true).limit(1);
  if (!students?.length) return `Hi! I couldn\'t find a student linked to this number at ${schoolName}.\n\nPlease contact the school office to link your number.`;
  const student = students[0];
  const { data: records } = await supabase
    .from('attendance').select('date, status')
    .eq('student_id', student.id).order('date', { ascending: false }).limit(7);
  if (!records?.length) return `Hi! ${student.name} (Class ${student.class}${student.section}) has no attendance records yet this term.`;
  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const pct = Math.round((present / records.length) * 100);
  const lines = records.map(r => {
    const d = new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const icon = r.status === 'present' ? '✅' : r.status === 'late' ? '\u{1F550}' : '❌';
    return `${icon} ${d} — ${r.status.charAt(0).toUpperCase() + r.status.slice(1)}`;
  }).join('\n');
  return `📋 *Attendance — ${student.name}*\nClass ${student.class}-${student.section}\n\n${lines}\n\n📊 Last ${records.length} days: *${pct}% present*`;
}

async function handleFees(supabase: ReturnType<typeof getSupabase>, phone: string, schoolId: string, schoolName: string): Promise<string> {
  const normalizedPhone = phone.replace('whatsapp:', '');
  const { data: students } = await supabase
    .from('students').select('id, name, class, section')
    .eq('school_id', schoolId).eq('phone_parent', normalizedPhone).eq('is_active', true).limit(1);
  if (!students?.length) return `Hi! I couldn\'t find a student linked to this number.\n\nCall the school for assistance.`;
  const student = students[0];
  const { data: fees } = await supabase
    .from('fees').select('amount, due_date, status, fee_type, description')
    .eq('student_id', student.id).in('status', ['pending','overdue']).order('due_date', { ascending: true });
  if (!fees?.length) return `✅ Great news! ${student.name}\'s fees are all clear. No pending payments.`;
  const total = fees.reduce((sum, f) => sum + Number(f.amount), 0);
  const lines = fees.map(f => {
    const due = new Date(f.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${f.status === 'overdue' ? '🔴' : '🟡'} ${f.description || f.fee_type} — ₹${Number(f.amount).toLocaleString('en-IN')} (Due: ${due})`;
  }).join('\n');
  return `💰 *Pending Fees — ${student.name}*\nClass ${student.class}-${student.section}\n\n${lines}\n\n*Total Due: ₹${total.toLocaleString('en-IN')}*\n\nPay at the school fee counter or via the portal.`;
}

async function handleEvents(supabase: ReturnType<typeof getSupabase>, schoolId: string, schoolName: string): Promise<string> {
  const { data: events } = await supabase
    .from('events').select('title, description, event_date, is_holiday')
    .eq('school_id', schoolId).gte('event_date', new Date().toISOString().split('T')[0])
    .order('event_date', { ascending: true }).limit(3);
  if (!events?.length) return `📅 No upcoming events at ${schoolName} right now. We\'ll notify you when something is scheduled!`;
  const lines = events.map(e => {
    const d = new Date(e.event_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    return `${e.is_holiday ? '🏖️' : '📌'} *${e.title}*\n   ${d}${e.description ? '\n   ' + e.description : ''}`;
  }).join('\n\n');
  return `📅 *Upcoming Events — ${schoolName}*\n\n${lines}`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', function: 'whatsapp-bot', version: 8 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const from = params.get('From') ?? '';
    const body = (params.get('Body') ?? '').trim();
    const numMedia = parseInt(params.get('NumMedia') ?? '0');
    const phone = from.replace('whatsapp:', '');

    if (!body && numMedia === 0) {
      return twimlResponse(`Hi! 👋 I\'m the school assistant. Ask me about:\n• Attendance\n• Fees\n• Upcoming events\n• Admissions`);
    }

    const supabase = getSupabase();

    // Find school by SCHOOL_ID constant (single-tenant for now)
    // Multi-tenant: would map Twilio number to school
    const { data: school } = await supabase
      .from('schools').select('id, name').eq('id', SCHOOL_ID).maybeSingle();
    const schoolId = school?.id ?? SCHOOL_ID;
    const schoolName = school?.name ?? SCHOOL_NAME_DEFAULT;

    // Check if known parent
    const { data: parent } = await supabase
      .from('parents').select('id, name').eq('school_id', schoolId).eq('phone', phone).maybeSingle();

    const sessionId = `${phone}_${schoolId}`;
    let response = '';
    let intent = detectIntent(body);

    if (parent) {
      // Known parent — route to attendance/fees/events handlers or portal
      switch (intent) {
        case 'attendance': response = await handleAttendance(supabase, from, schoolId, schoolName); break;
        case 'fees': response = await handleFees(supabase, from, schoolId, schoolName); break;
        case 'events': response = await handleEvents(supabase, schoolId, schoolName); break;
        default:
          const lower = body.toLowerCase();
          if (['hi','hello','hey','hii','namaste'].some(g => lower.startsWith(g))) {
            response = `Hi ${parent.name}! 👋\n\nI can help with:\n1️⃣ *Attendance* — Type "attendance"\n2️⃣ *Fees* — Type "fees"\n3️⃣ *Events* — Type "events"\n\nOr visit: school-os-rh47.vercel.app/parent/login`;
            intent = 'existing_parent';
          } else {
            // Use knowledge base for other queries
            const context = await getRelevantKnowledge(supabase, schoolId, body);
            response = await generateCounselorResponse(schoolName, context, body, '');
            intent = 'existing_parent';
          }
      }
    } else {
      // Prospective parent — AI admission counselor
      if (intent === 'attendance' || intent === 'fees') {
        // Unknown parent asking about attendance/fees — likely confused
        response = `Hi! It seems you\'re not registered as a parent at ${schoolName} yet.\n\nFor admission enquiries or to register, please call us directly or visit the school.`;
        intent = 'admission_inquiry';
      } else {
        // Get conversation history for context
        const { data: history } = await supabase
          .from('conversations').select('message, response')
          .eq('school_id', schoolId).eq('phone_number', phone).eq('session_id', sessionId)
          .order('created_at', { ascending: false }).limit(3);
        const historyText = (history ?? []).reverse().map(h => `Parent: ${h.message}\nBot: ${h.response}`).join('\n');

        // Handle greeting
        const lower = body.toLowerCase();
        if (['hi','hello','hey','hii','namaste'].some(g => lower.startsWith(g))) {
          response = `Hi! 👋 Welcome to *${schoolName}*\n\nI\'m your AI admission assistant. I can answer questions about:\n• Admissions & eligibility\n• Fee structure\n• School policies\n• Transport & facilities\n\nWhat would you like to know?`;
          intent = 'admission_inquiry';
        } else {
          const context = await getRelevantKnowledge(supabase, schoolId, body);
          response = await generateCounselorResponse(schoolName, context, body, historyText);
          intent = intent === 'unknown' ? 'admission_inquiry' : intent;
        }

        // Upsert to inquiries CRM (best-effort)
        await supabase.from('inquiries').upsert({
          school_id: schoolId,
          phone,
          parent_name: 'WhatsApp Lead',
          source: 'whatsapp_bot',
          status: 'new',
          notes: `First message: ${body.slice(0, 200)}`,
        }, { onConflict: 'school_id,phone', ignoreDuplicates: true }).catch(() => {});
      }
    }

    // Log conversation
    await supabase.from('conversations').insert({
      school_id: schoolId,
      phone_number: phone,
      direction: 'inbound',
      message: body,
      intent,
      response,
      session_id: sessionId,
      language: 'en',
      metadata: { from_known_parent: !!parent },
    }).catch(() => {});

    return twimlResponse(response);

  } catch (err) {
    console.error('WhatsApp bot error:', err);
    return twimlResponse('Something went wrong. Please try again or call the school directly.');
  }
});
