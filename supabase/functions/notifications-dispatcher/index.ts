// Item 14a — notifications-dispatcher Edge Function
//
// Triggered by pg_cron every 5 minutes via net.http_post with X-DISPATCH-SECRET header.
// Claims pending notifications via claim_pending_notifications RPC (FOR UPDATE SKIP LOCKED).
// For each claimed row: resolves recipients per module, then either:
//   - dry_run mode (default): console.logs masked phones, marks row 'skipped'
//   - live mode: posts to Twilio API per recipient, marks row 'dispatched' or 'failed'
//
// Environment secrets (set via Supabase functions secrets):
//   DISPATCH_SECRET                — shared header secret with pg_cron job (REQUIRED)
//   NOTIFICATIONS_DISPATCH_MODE   — 'dry_run' (default) | 'live'
//   NOTIFICATIONS_BATCH_CAP       — integer string, default '5'
//   TWILIO_ACCOUNT_SID            — required only when mode=live
//   TWILIO_AUTH_TOKEN             — required only when mode=live
//   TWILIO_WHATSAPP_FROM          — required only when mode=live (e.g. 'whatsapp:+14155238886')
//
// Spawn 7 inheritance:
//   #24: Twilio credentials currently failing 401. Dispatcher fails-soft if live mode
//        is enabled but TWILIO_* secrets are missing or auth fails.
//
// PII redaction (DPDP posture): all phone numbers in console.log output go through
// maskPhone() which keeps the country code prefix and last 4 digits, masking middle.

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

// =============================================================================
// Helpers
// =============================================================================

/**
 * Mask a phone number for PII-safe logging.
 * Keeps country-code prefix (+91) and last 4 digits; masks middle with X.
 * Example: +919100000101 → +91xxxxxx0101
 */
function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '<missing>';
  if (phone.length < 8) return phone.slice(0, 2) + 'xxx';
  // Find country code (assume starts with + and 1-3 digits, then mask the middle)
  const m = phone.match(/^(\+?\d{1,3})(.+)(\d{4})$/);
  if (!m) {
    // Fallback for non-standard formats
    return phone.slice(0, 2) + 'x'.repeat(Math.max(0, phone.length - 6)) + phone.slice(-4);
  }
  const cc = m[1];
  const middle = m[2];
  const last4 = m[3];
  return `${cc}${'x'.repeat(middle.length)}${last4}`;
}

interface NotificationRow {
  id: string;
  school_id: string;
  type: string;
  title: string;
  message: string;
  module: string | null;
  reference_id: string | null;
  channel: string | null;
  attempts: number;
}

interface Recipient {
  phone: string;
  name?: string;
}

interface DispatchSummary {
  mode: string;
  batch_cap: number;
  batch_size: number;
  dispatched: number;
  failed: number;
  skipped: number;
  errors: { notif_id: string; error: string }[];
}

// =============================================================================
// Recipient resolution
// =============================================================================

/**
 * Resolve recipients for a notification based on its module.
 *
 * homework_created  → all active parents whose student is in the homework's class
 * homework_graded   → the parent(s) of the specific student in the submission
 * teacher_late      → principals + admins of the school (PRE-FLIGHT-G inclusive)
 *
 * Returns empty array if no recipients (dispatcher then marks 0-recipient case).
 */
async function resolveRecipients(
  supabase: SupabaseClient,
  row: NotificationRow,
): Promise<Recipient[]> {
  const module = row.module ?? '';

  if (module === 'teacher_late') {
    // PRE-FLIGHT-G: inclusive resolution — principals OR admins.
    const { data, error } = await supabase
      .from('staff')
      .select('phone, name')
      .eq('school_id', row.school_id)
      .eq('is_active', true)
      .in('role', ['principal', 'admin']);
    if (error) {
      console.error(`Recipient resolve error (teacher_late, notif=${row.id}):`, error.message);
      return [];
    }
    return (data ?? []).filter(r => r.phone).map(r => ({ phone: r.phone, name: r.name }));
  }

  if (module === 'homework_created') {
    // homework's class -> students in class -> parents of those students.
    // reference_id is homework.id.
    if (!row.reference_id) return [];

    const { data: hw, error: hwErr } = await supabase
      .from('homework')
      .select('class_id, school_id')
      .eq('id', row.reference_id)
      .eq('school_id', row.school_id)
      .maybeSingle();
    if (hwErr || !hw || !hw.class_id) {
      if (hwErr) console.error(`Homework lookup error (notif=${row.id}):`, hwErr.message);
      return [];
    }

    // Resolve class -> grade_level + section (students.class is TEXT per Spawn 7 #1)
    const { data: cls } = await supabase
      .from('classes')
      .select('grade_level, section')
      .eq('id', hw.class_id)
      .eq('school_id', row.school_id)
      .maybeSingle();
    if (!cls) return [];

    // Find students in that class+section that are active
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('school_id', row.school_id)
      .eq('class', cls.grade_level)
      .eq('section', cls.section)
      .eq('is_active', true);

    const studentIds = (students ?? []).map(s => s.id);
    if (studentIds.length === 0) return [];

    // Find parents for those students
    const { data: parents } = await supabase
      .from('parents')
      .select('phone, name')
      .eq('school_id', row.school_id)
      .in('student_id', studentIds)
      .not('phone', 'is', null);

    return (parents ?? []).filter(p => p.phone).map(p => ({ phone: p.phone, name: p.name }));
  }

  if (module === 'homework_graded') {
    // reference_id is homework_submission.id. Look up student_id, then parents.
    if (!row.reference_id) return [];

    const { data: sub } = await supabase
      .from('homework_submissions')
      .select('student_id')
      .eq('id', row.reference_id)
      .maybeSingle();
    if (!sub) return [];

    const { data: parents } = await supabase
      .from('parents')
      .select('phone, name')
      .eq('school_id', row.school_id)
      .eq('student_id', sub.student_id)
      .not('phone', 'is', null);

    return (parents ?? []).filter(p => p.phone).map(p => ({ phone: p.phone, name: p.name }));
  }

  // Unknown module — return empty (dispatcher marks 0-recipient case)
  console.warn(`Unknown module for recipient resolution (notif=${row.id}, module=${module})`);
  return [];
}

// =============================================================================
// Twilio dispatch (live mode only)
// =============================================================================

async function sendViaTwilio(
  toPhone: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return { ok: false, error: 'TWILIO_* secrets missing — cannot send in live mode' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  // Twilio expects WhatsApp recipient prefixed with 'whatsapp:'
  const toFormatted = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;

  const form = new URLSearchParams();
  form.append('From', TWILIO_WHATSAPP_FROM);
  form.append('To', toFormatted);
  form.append('Body', message);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
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
): Promise<{ status: 'dispatched' | 'failed' | 'skipped'; error?: string; targetCount: number }> {
  const recipients = await resolveRecipients(supabase, row);

  if (recipients.length === 0) {
    // No recipients: mark skipped with explanatory error.
    return {
      status: 'skipped',
      error: '0 recipients resolved',
      targetCount: 0,
    };
  }

  // DRY-RUN MODE: log + return skipped, no Twilio calls
  if (DISPATCH_MODE !== 'live') {
    for (const r of recipients) {
      console.log(
        `[dry_run] would send to ${maskPhone(r.phone)}: ` +
        `"${row.title}" — ${row.message.slice(0, 80)}${row.message.length > 80 ? '...' : ''}`
      );
    }
    return {
      status: 'skipped',
      error: `dry_run_mode (${recipients.length} recipient(s) logged)`,
      targetCount: recipients.length,
    };
  }

  // LIVE MODE: per-recipient Twilio send. On first failure, break loop and mark row failed.
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    // Fail-soft for missing credentials (Spawn 7 #24)
    console.error(`[live] TWILIO_* secrets missing for notif=${row.id} — marking failed`);
    return {
      status: 'failed',
      error: 'TWILIO_* secrets missing (live mode requires them)',
      targetCount: 0,
    };
  }

  let sentCount = 0;
  for (const r of recipients) {
    const result = await sendViaTwilio(r.phone, `${row.title}\n\n${row.message}`);
    if (!result.ok) {
      console.error(
        `[live] Twilio send failed for notif=${row.id} ` +
        `to=${maskPhone(r.phone)}: ${result.error}`
      );
      return {
        status: 'failed',
        error: `Twilio send failed (sent ${sentCount}/${recipients.length}): ${result.error}`,
        targetCount: sentCount,
      };
    }
    sentCount++;
    console.log(`[live] sent to ${maskPhone(r.phone)} (notif=${row.id})`);
  }

  return {
    status: 'dispatched',
    targetCount: sentCount,
  };
}

// =============================================================================
// HTTP entrypoint
// =============================================================================

Deno.serve(async (req: Request) => {
  try {
    // Custom auth: shared secret header (pg_cron sends X-DISPATCH-SECRET via net.http_post)
    const presentedSecret = req.headers.get('X-DISPATCH-SECRET') ?? '';
    if (!DISPATCH_SECRET) {
      return new Response(
        JSON.stringify({ error: 'DISPATCH_SECRET not configured on server' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (presentedSecret !== DISPATCH_SECRET) {
      console.error('Dispatcher: invalid or missing X-DISPATCH-SECRET');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Claim batch via RPC (FOR UPDATE SKIP LOCKED inside the function).
    const { data: claimed, error: claimErr } = await supabase.rpc('claim_pending_notifications', {
      batch_cap: BATCH_CAP,
    });

    if (claimErr) {
      console.error('claim_pending_notifications RPC error:', claimErr.message);
      return new Response(
        JSON.stringify({ error: `RPC failed: ${claimErr.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rows: NotificationRow[] = claimed ?? [];
    const summary: DispatchSummary = {
      mode: DISPATCH_MODE,
      batch_cap: BATCH_CAP,
      batch_size: rows.length,
      dispatched: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    if (rows.length === 0) {
      // Nothing to do
      return new Response(
        JSON.stringify(summary),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Dispatcher tick: mode=${DISPATCH_MODE}, claimed ${rows.length} row(s)`);

    // Process each claimed row
    for (const row of rows) {
      const result = await dispatchOne(supabase, row);

      // Update the row with final state.
      const updatePatch: Record<string, unknown> = {
        status: result.status,
        attempts: row.attempts + 1,
        last_attempt_at: new Date().toISOString(),
        dispatch_error: result.error ?? null,
        target_count: result.targetCount,
      };
      if (result.status === 'dispatched') {
        updatePatch.dispatched_at = new Date().toISOString();
      }

      const { error: updErr } = await supabase
        .from('notifications')
        .update(updatePatch)
        .eq('id', row.id);

      if (updErr) {
        console.error(`Failed to update notif=${row.id} state:`, updErr.message);
        summary.errors.push({ notif_id: row.id, error: `update failed: ${updErr.message}` });
      }

      // Count for summary
      if (result.status === 'dispatched') summary.dispatched++;
      else if (result.status === 'failed') summary.failed++;
      else summary.skipped++;

      if (result.error && result.status === 'failed') {
        summary.errors.push({ notif_id: row.id, error: result.error });
      }
    }

    console.log(
      `Dispatcher tick done: dispatched=${summary.dispatched}, ` +
      `failed=${summary.failed}, skipped=${summary.skipped}`
    );

    return new Response(
      JSON.stringify(summary),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Dispatcher fatal error:', err);
    return new Response(
      JSON.stringify({ error: `Dispatcher fatal: ${String(err)}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
