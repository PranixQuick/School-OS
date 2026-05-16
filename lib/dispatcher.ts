import { supabaseAdmin } from './supabaseClient';
import { sendWhatsApp, normalisePhone } from './whatsapp';
import { sendEmail, buildEmailHtml } from './email';
import { logError } from './logger';

const MAX_ATTEMPTS = 3;

interface NotificationRow {
  id: string;
  school_id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  attempts: number;
}

interface SchoolInfo {
  id: string;
  name: string;
  contact_email: string | null;
}

// ─── Determine recipients for a notification ─────────────────────────────────

async function getRecipients(notification: NotificationRow): Promise<{
  phones: string[];
  emails: string[];
}> {
  const phones: string[] = [];
  const emails: string[] = [];

  // For fee reminders and PTM — target parents from the parents table
  if (notification.type === 'fee_reminder' || notification.type === 'ptm') {
    const { data } = await supabaseAdmin
      .from('parents')
      .select('phone, email')
      .eq('school_id', notification.school_id)
      .limit(50); // safety cap

    for (const parent of data ?? []) {
      const phone = normalisePhone(parent.phone);
      if (phone) phones.push(phone);
      if (parent.email) emails.push(parent.email);
    }
    return { phones, emails };
  }

  // For risk/alert/system — target school admin users
  if (notification.type === 'risk' || notification.type === 'alert' || notification.type === 'system') {
    const { data } = await supabaseAdmin
      .from('school_users')
      .select('email')
      .eq('school_id', notification.school_id)
      .eq('is_active', true)
      .in('role', ['owner', 'admin']);

    for (const user of data ?? []) {
      if (user.email) emails.push(user.email);
    }
    return { phones: [], emails };
  }

  // For broadcast — target all parents
  const { data } = await supabaseAdmin
    .from('parents')
    .select('phone, email')
    .eq('school_id', notification.school_id)
    .limit(200);

  for (const parent of data ?? []) {
    const phone = normalisePhone(parent.phone);
    if (phone) phones.push(phone);
    if (parent.email) emails.push(parent.email);
  }

  return { phones, emails };
}

// ─── Dispatch a single notification ──────────────────────────────────────────

export async function dispatchNotification(
  notification: NotificationRow,
  school: SchoolInfo
): Promise<{ dispatched: number; failed: number }> {
  let dispatched = 0;
  let failed = 0;

  const { phones, emails } = await getRecipients(notification);

  const channel = notification.channel ?? 'whatsapp';
  const sendViaWhatsApp = channel === 'whatsapp' || channel === 'both';
  const sendViaEmail = channel === 'email' || channel === 'both';

  // Dispatch via WhatsApp
  if (sendViaWhatsApp && phones.length > 0) {
    for (const phone of phones) {
      try {
        const result = await sendWhatsApp({
          to: phone,
          body: notification.message,
          schoolName: school.name,
        });

        await supabaseAdmin.from('dispatch_log').insert({
          notification_id: notification.id,
          school_id: notification.school_id,
          channel: 'whatsapp',
          recipient: phone,
          status: result.success ? 'sent' : 'failed',
          provider: result.provider,
          provider_message_id: result.messageId ?? null,
          error: result.error ?? null,
        });

        result.success ? dispatched++ : failed++;
      } catch (err) {
        failed++;
        await logError({ route: 'dispatcher:whatsapp', error: String(err), schoolId: notification.school_id });
      }
    }
  }

  // Dispatch via Email
  if (sendViaEmail && emails.length > 0) {
    const htmlBody = buildEmailHtml({
      schoolName: school.name,
      title: notification.title,
      body: notification.message,
      footer: `${school.name} · This is an automated message from EdProSys`,
    });

    for (const email of emails) {
      try {
        const result = await sendEmail({
          to: email,
          subject: `${notification.title} — ${school.name}`,
          body: notification.message,
          htmlBody,
          from: school.contact_email ?? undefined,
        });

        await supabaseAdmin.from('dispatch_log').insert({
          notification_id: notification.id,
          school_id: notification.school_id,
          channel: 'email',
          recipient: email,
          status: result.success ? 'sent' : 'failed',
          provider: result.provider,
          provider_message_id: result.messageId ?? null,
          error: result.error ?? null,
        });

        result.success ? dispatched++ : failed++;
      } catch (err) {
        failed++;
        await logError({ route: 'dispatcher:email', error: String(err), schoolId: notification.school_id });
      }
    }
  }

  // If no recipients found at all
  if (phones.length === 0 && emails.length === 0) {
    await supabaseAdmin.from('notifications')
      .update({
        status: 'skipped',
        last_attempt_at: new Date().toISOString(),
        attempts: notification.attempts + 1,
      })
      .eq('id', notification.id);
    return { dispatched: 0, failed: 0 };
  }

  // Update notification status
  const allFailed = dispatched === 0 && failed > 0;
  const newAttempts = notification.attempts + 1;
  const newStatus = allFailed && newAttempts >= MAX_ATTEMPTS ? 'failed'
    : dispatched > 0 ? 'dispatched'
    : 'pending'; // will retry

  await supabaseAdmin.from('notifications').update({
    status: newStatus,
    attempts: newAttempts,
    last_attempt_at: new Date().toISOString(),
    dispatched_at: dispatched > 0 ? new Date().toISOString() : null,
    dispatch_error: allFailed ? 'All dispatch attempts failed' : null,
  }).eq('id', notification.id);

  return { dispatched, failed };
}

// ─── Process all pending notifications for a school ───────────────────────────

export async function processPendingNotifications(
  schoolId: string,
  options: { limit?: number } = {}
): Promise<{ processed: number; dispatched: number; failed: number; skipped: number }> {
  const limit = options.limit ?? 20;

  // Fetch school info
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('id, name, contact_email')
    .eq('id', schoolId)
    .single();

  if (!school) return { processed: 0, dispatched: 0, failed: 0, skipped: 0 };

  // Fetch pending notifications (include failed ones with retries remaining)
  const { data: notifications } = await supabaseAdmin
    .from('notifications')
    .select('id, school_id, type, title, message, channel, attempts')
    .eq('school_id', schoolId)
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!notifications || notifications.length === 0) {
    return { processed: 0, dispatched: 0, failed: 0, skipped: 0 };
  }

  let totalDispatched = 0;
  let totalFailed = 0;
  let skipped = 0;

  for (const notif of notifications) {
    const result = await dispatchNotification(notif, school);
    totalDispatched += result.dispatched;
    totalFailed += result.failed;
    if (result.dispatched === 0 && result.failed === 0) skipped++;
  }

  return {
    processed: notifications.length,
    dispatched: totalDispatched,
    failed: totalFailed,
    skipped,
  };
}
