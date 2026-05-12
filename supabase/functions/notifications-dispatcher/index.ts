// Item 14a (original) + Item #14 HSM enhancement — notifications-dispatcher Edge Function
//
// Triggered by pg_cron every 5 minutes via net.http_post with X-DISPATCH-SECRET header.
// Claims pending + awaiting_template notifications via claim_pending_notifications RPC.
// For each claimed row: resolves recipients per module, then:
//   - Resolves Twilio Content Template SID from env var for the notification type
//   - IF template SID missing or Twilio rejects: sets status='awaiting_template' (NOT failed)
//   - dry_run mode (default): console.logs, marks 'skipped'
//   - live mode: posts to Twilio Content API, marks 'dispatched' or 'failed'/'awaiting_template'
//
// Environment secrets (set via Supabase functions secrets):
//   DISPATCH_SECRET                — shared header secret with pg_cron job (REQUIRED)
//   NOTIFICATIONS_DISPATCH_MODE   — 'dry_run' (default) | 'live'
//   NOTIFICATIONS_BATCH_CAP       — integer string, default '5'
//   TWILIO_ACCOUNT_SID            — required only when mode=live
//   TWILIO_AUTH_TOKEN             — required only when mode=live
//   TWILIO_WHATSAPP_FROM          — required only when mode=live (e.g. 'whatsapp:+14155238886')
//
// HSM Template SID env vars (add after Twilio Content Template Builder approval):
//   TWILIO_TEMPLATE_FEE_REMINDER      — fee_reminder notification type
//   TWILIO_TEMPLATE_HOMEWORK          — homework_assigned notification type
//   TWILIO_TEMPLATE_ATTENDANCE        — attendance_alert notification type
//   TWILIO_TEMPLATE_LEAVE             — leave_status notification type
//   TWILIO_TEMPLATE_BROADCAST         — broadcast notification type
//
// awaiting_template behavior:
//   If template SID env var is missing or Twilio returns a template error:
//   - status → awaiting_template (not failed)
//   - dispatch_error set to explain why
//   - Row will be retried automatically when TWILIO_TEMPLATE_* env var is added
//     (claim_pending_notifications RPC picks up awaiting_template rows)
//
// PRE-FLIGHT-G: teacher_late recipients = principals + admin_staff (not 'admin')

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =============================================================================
// Environment + constants
// =============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const DISPATCH_SECRET = Deno.env.get('DISPATCH_SECRET') ?? '';
const DISPATCH_MODE = (Deno.env.get('NOTIFICATIONS_DISPATCH_MODE') ?? 'dry_run').toLowerCase();
const BATCH_CAP_RAW = Deno.env.get('NOTIFICATIONS_BATCH_CAP') ?? '5';
const BATCH_CAP = Math.max(1, Math.min(50, parseInt(BATCH_CAP_RAW, 10) || 5));
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? '';
const MAX_ATTEMPTS = 3;

// HSM Template SIDs — resolved from env vars per notification type
// These are Twilio Content Template SIDs (format: HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
const TEMPLATE_SIDS: Record<string, string | undefined> = {
  fee_reminder:       Deno.env.get('TWILIO_TEMPLATE_FEE_REMINDER'),
  homework_assigned:  Deno.env.get('TWILIO_TEMPLATE_HOMEWORK'),
  attendance_alert:   Deno.env.get('TWILIO_TEMPLATE_ATTENDANCE'),
  leave_status:       Deno.env.get('TWILIO_TEMPLATE_LEAVE'),
  broadcast:          Deno.env.get('TWILIO_TEMPLATE_BROADCAST'),
};

// =============================================================================
// Helpers
// =============================================================================

function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '<missing>';
  if (phone.length < 8) return phone.slice(0, 2) + 'xxx';
  const m = phone.match(/^(\+?\d{1,3})(.+)(\d{4})$/);
  if (!m) {
    return phone.slice(0, 2) + 'x'.repeat(Math.max(0, phone.length - 6)) + phone.slice(-4);
  }
  const cc = m[1]; const middle = m[2]; const last4 = m[3];
  return `${cc}${'x'.repeat(middle.length)}${last4}`;
}

/**
 * Resolve the Twilio Content Template SID for a notification type.
 * Returns undefined if the env var is not set.
 */
function resolveTemplateSid(notifType: string): string | undefined {
  return TEMPLATE_SIDS[notifType];
}

interface NotificationRow {
  id: string; school_id: string; type: string; title: string; message: string;
  module: string | null; reference_id: string | null; channel: string | null; attempts: number;
}

interface Recipient { phone: string; name?: string; }

interface DispatchSummary {
  mode: string; batch_cap: number; batch_size: number;
  dispatched: number; failed: number; skipped: number; awaiting_template: number;
  errors: { notif_id: string; error: string }[];
}

// =============================================================================
// Recipient resolution (unchanged from Item 14a)
// =============================================================================

async function resolveRecipients(supabase: SupabaseClient, row: NotificationRow): Promise<Recipient[]> {
  const module = row.module ?? '';

  if (module === 'teacher_late') {
    const { data, error } = await supabase
      .from('staff').select('phone, name')
      .eq('school_id', row.school_id).eq('is_active', true)
      .in('role', ['principal', 'admin_staff']); // PRE-FLIGHT-G: admin_staff not 'admin'
    if (error) { console.error(`Recipient resolve error (teacher_late, notif=${row.id}):`, error.message); return []; }
    return (data ?? []).filter(r => r.phone).map(r => ({ phone: r.phone, name: r.name }));
  }

  if (module === 'homework_created' || row.type === 'homework_assigned') {
    if (!row.reference_id) return [];
    const { data: hw, error: hwErr } = await supabase
      .from('homework').select('class_id, school_id')
      .eq('id', row.reference_id).eq('school_id', row.school_id).maybeSingle();
    if (hwErr || !hw || !hw.class_id) { if (hwErr) console.error(`Homework lookup error (notif=${row.id}):`, hwErr.message); return []; }

    const { data: cls } = await supabase.from('classes').select('grade_level, section')
      .eq('id', hw.class_id).eq('school_id', row.school_id).maybeSingle();
    if (!cls) return [];

    const { data: students } = await supabase.from('students').select('id')
      .eq('school_id', row.school_id).eq('class', cls.grade_level).eq('section', cls.section).eq('is_active', true);
    const studentIds = (students ?? []).map(s => s.id);
    if (studentIds.length === 0) return [];

    const { data: parents } = await supabase.from('parents').select('phone, name')
      .eq('school_id', row.school_id).in('student_id', studentIds).not('phone', 'is', null);
    return (parents ?? []).filter(p => p.phone).map(p => ({ phone: p.phone, name: p.name }));
  }

  if (module === 'homework_graded') {
    if (!row.reference_id) return [];
    const { data: sub } = await supabase.from('homework_submissions').select('student_id')
      .eq('id', row.reference_id).maybeSingle();
    if (!sub) return [];
    const { data: parents } = await supabase.from('parents').select('phone, name')
      .eq('school_id', row.school_id).eq('student_id', sub.student_id).not('phone', 'is', null);
    return (parents ?? []).filter(p => p.phone).map(p => ({ phone: p.phone, name: p.name }));
  }

  if (row.type === 'fee_reminder' || row.type === 'leave_status' || row.type === 'attendance_alert') {
    // For fee/leave/attendance: look up parent(s) via reference_id (fee.id or leave_request.id)
    // reference_id should be the student_id or fee student_id
    // Simple path: find parents for school (broadcaster pattern for now; specific hookup in PR #2)
    if (!row.reference_id) return [];
    const { data: parents } = await supabase.from('parents').select('phone, name')
      .eq('school_id', row.school_id).not('phone', 'is', null);
    return (parents ?? []).filter(p => p.phone).map(p => ({ phone: p.phone, name: p.name }));
  }

  if (row.type === 'broadcast' || row.module === 'announcement') {
    // Broadcast: send to all active parents in the school
    const { data: parents } = await supabase.from('parents').select('phone, name')
      .eq('school_id', row.school_id).not('phone', 'is', null);
    return (parents ?? []).filter(p => p.phone).map(p => ({ phone: p.phone, name: p.name }));
  }

  console.warn(`Unknown module/type for recipient resolution (notif=${row.id}, module=${module}, type=${row.type})`);
  return [];
}

// =============================================================================
// Twilio HSM send (live mode)
// =============================================================================

interface TwilioResult { ok: boolean; error?: string; awaiting_template?: boolean; }

async function sendViaTwilio(
  toPhone: string,
  message: string,
  templateSid: string | undefined,
  notifType: string,
): Promise<TwilioResult> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: 'TWILIO_* secrets missing — cannot send in live mode' };
  }

  // HSM TEMPLATE SID REQUIRED — if missing, signal awaiting_template (not failed)
  if (!templateSid) {
    const envKey = `TWILIO_TEMPLATE_${notifType.toUpperCase().replace(/_/g, '_')}`;
    console.log(`[live] template SID not configured for type=${notifType} (${envKey}) — awaiting_template`);
    return { ok: false, awaiting_template: true, error: `template_sid_not_configured: ${envKey}` };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const toFormatted = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;

  const form = new URLSearchParams();
  form.append('From', TWILIO_WHATSAPP_FROM);
  form.append('To', toFormatted);
  // Use ContentSid for approved HSM templates; Body is the fallback text
  form.append('ContentSid', templateSid);
  form.append('Body', message); // fallback for non-HSM-capable endpoints / logging

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      // Twilio 63016/63017 = template not approved / not found → awaiting_template
      const isTemplateError = errText.includes('63016') || errText.includes('63017') ||
                              errText.includes('template') || errText.includes('Content') ||
                              res.status === 400;
      if (isTemplateError) {
        console.log(`[live] Twilio template error for type=${notifType}: ${errText.slice(0, 200)}`);
        return { ok: false, awaiting_template: true, error: `twilio_error: ${errText.slice(0, 300)}` };
      }
      return { ok: false, error: `Twilio HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Twilio fetch error: ${String(err).slice(0, 200)}` };
  }
}

// =============================================================================
// Main dispatcher
// =============================================================================

async function dispatchOne(
  supabase: SupabaseClient,
  row: NotificationRow,
): Promise<{ status: 'dispatched' | 'failed' | 'skipped' | 'awaiting_template'; error?: string; targetCount: number }> {
  const recipients = await resolveRecipients(supabase, row);

  if (recipients.length === 0) {
    return { status: 'skipped', error: '0 recipients resolved', targetCount: 0 };
  }

  if (DISPATCH_MODE !== 'live') {
    const templateSid = resolveTemplateSid(row.type);
    for (const r of recipients) {
      console.log(
        `[dry_run] would send to ${maskPhone(r.phone)} (template=${templateSid ?? 'NOT_CONFIGURED'}): ` +
        `"${row.title}" — ${row.message.slice(0, 80)}${row.message.length > 80 ? '...' : ''}`
      );
    }
    return { status: 'skipped', error: `dry_run_mode (${recipients.length} recipient(s) logged)`, targetCount: recipients.length };
  }

  // LIVE MODE
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.error(`[live] TWILIO_* secrets missing for notif=${row.id} — marking failed`);
    return { status: 'failed', error: 'TWILIO_* secrets missing (live mode requires them)', targetCount: 0 };
  }

  const templateSid = resolveTemplateSid(row.type);
  let sentCount = 0;

  for (const r of recipients) {
    const result = await sendViaTwilio(r.phone, `${row.title}\n\n${row.message}`, templateSid, row.type);

    if (!result.ok) {
      if (result.awaiting_template) {
        // Template not configured or not yet approved — move row to awaiting_template, do NOT fail
        // Subsequent recipients of this notification will also be blocked, so break early
        console.log(`[live] awaiting_template for notif=${row.id}, type=${row.type}: ${result.error}`);
        return { status: 'awaiting_template', error: result.error, targetCount: sentCount };
      }
      console.error(
        `[live] Twilio send failed for notif=${row.id} to=${maskPhone(r.phone)}: ${result.error}`
      );
      return { status: 'failed', error: `Twilio send failed (sent ${sentCount}/${recipients.length}): ${result.error}`, targetCount: sentCount };
    }
    sentCount++;
    console.log(`[live] sent to ${maskPhone(r.phone)} (notif=${row.id})`);
  }

  return { status: 'dispatched', targetCount: sentCount };
}

// =============================================================================
// HTTP entrypoint
// =============================================================================

Deno.serve(async (req: Request) => {
  try {
    const presentedSecret = req.headers.get('X-DISPATCH-SECRET') ?? '';
    if (!DISPATCH_SECRET) {
      return new Response(JSON.stringify({ error: 'DISPATCH_SECRET not configured on server' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    if (presentedSecret !== DISPATCH_SECRET) {
      console.error('Dispatcher: invalid or missing X-DISPATCH-SECRET');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: claimed, error: claimErr } = await supabase.rpc('claim_pending_notifications', { batch_cap: BATCH_CAP });

    if (claimErr) {
      console.error('claim_pending_notifications RPC error:', claimErr.message);
      return new Response(JSON.stringify({ error: `RPC failed: ${claimErr.message}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const rows: NotificationRow[] = claimed ?? [];
    const summary: DispatchSummary = {
      mode: DISPATCH_MODE, batch_cap: BATCH_CAP, batch_size: rows.length,
      dispatched: 0, failed: 0, skipped: 0, awaiting_template: 0, errors: [],
    };

    if (rows.length === 0) {
      return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    console.log(`Dispatcher tick: mode=${DISPATCH_MODE}, claimed ${rows.length} row(s)`);

    for (const row of rows) {
      const result = await dispatchOne(supabase, row);

      const updatePatch: Record<string, unknown> = {
        status: result.status,
        attempts: row.attempts + 1,
        last_attempt_at: new Date().toISOString(),
        dispatch_error: result.error ?? null,
        target_count: result.targetCount,
      };
      if (result.status === 'dispatched') { updatePatch.dispatched_at = new Date().toISOString(); }

      const { error: updErr } = await supabase.from('notifications').update(updatePatch).eq('id', row.id);
      if (updErr) { console.error(`Failed to update notif=${row.id} state:`, updErr.message); summary.errors.push({ notif_id: row.id, error: `update failed: ${updErr.message}` }); }

      if (result.status === 'dispatched') summary.dispatched++;
      else if (result.status === 'failed') summary.failed++;
      else if (result.status === 'awaiting_template') summary.awaiting_template++;
      else summary.skipped++;

      if (result.error && result.status === 'failed') { summary.errors.push({ notif_id: row.id, error: result.error }); }
    }

    console.log(`Dispatcher tick done: dispatched=${summary.dispatched}, failed=${summary.failed}, skipped=${summary.skipped}, awaiting_template=${summary.awaiting_template}`);

    return new Response(JSON.stringify(summary), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Dispatcher fatal error:', err);
    return new Response(JSON.stringify({ error: `Dispatcher fatal: ${String(err)}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
