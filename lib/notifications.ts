import type { SupabaseClient } from '@supabase/supabase-js';

// Item 14a — notifications writer helper.
//
// Centralized helper for inserting rows into public.notifications.
// Used by event-write call sites in /api/teacher/homework/create, /grade, /checkin.
//
// Spawn 7 inheritance:
//   #20: supabase-js v2 .select() after writes does NOT accept count/head options.
//        This helper uses .insert(...).select('id').single() — the SAFE pattern
//        (select with one arg only). Do NOT add a second options arg.
//   #22: parents UNIQUE(school_id, phone) means 1 row per phone per school.
//        Not enforced here; dispatcher resolves recipients per-row.
//   #24: Twilio credentials currently failing 401 (engine quota check). Dispatcher
//        is dry-run-by-default. This writer is dispatcher-agnostic — just writes
//        rows; dispatcher decides whether to actually send.
//
// CRITICAL — notifications.type is a DB CHECK enum:
//   'broadcast' | 'fee_reminder' | 'ptm' | 'alert' | 'system' | 'risk'
// Item 14a's locked mapping:
//   homework_created  → type='alert', module='homework_created'
//   homework_graded   → type='alert', module='homework_graded'
//   teacher_late      → type='risk',  module='teacher_late'
//   (announcement_published deferred to a later item — no announcement-write route yet)
//
// All writers are best-effort: caller wraps in try/catch and continues on failure.
// This helper returns {ok, id?, error?} rather than throwing.

export type NotificationType = 'broadcast' | 'fee_reminder' | 'ptm' | 'alert' | 'system' | 'risk';
export type NotificationChannel = 'whatsapp' | 'email' | 'both' | 'none';

export interface WriteNotificationParams {
  school_id: string;
  type: NotificationType;
  title: string;
  message: string;
  module: string;             // semantic richness for downstream filtering (homework_created, homework_graded, teacher_late, etc.)
  reference_id?: string | null;  // FK-like pointer to source row; nullable when source has no stable id
  channel?: NotificationChannel; // defaults to 'whatsapp'
}

export interface WriteNotificationResult {
  ok: boolean;
  id?: string;
  error?: string;
}

// Compile-time guard: the 6 valid types. If a caller ever passes a value outside this
// set (via a string variable cast to NotificationType, e.g.), Postgres CHECK still
// blocks the INSERT, but we want the TS layer to catch it earlier.
const VALID_TYPES: readonly NotificationType[] = ['broadcast', 'fee_reminder', 'ptm', 'alert', 'system', 'risk'] as const;
const VALID_CHANNELS: readonly NotificationChannel[] = ['whatsapp', 'email', 'both', 'none'] as const;

/**
 * Insert a row into public.notifications. The row starts in 'pending' status;
 * the notifications-dispatcher Edge Function (cron every 5 min) picks it up,
 * resolves recipients, and (in live mode) sends. In dry-run mode (default),
 * the dispatcher logs would-send messages and marks the row 'skipped'.
 *
 * Best-effort: callers should wrap in try/catch and continue on failure.
 * No exceptions thrown from this helper; errors returned via result.error.
 */
export async function writeNotification(
  supabaseAdmin: SupabaseClient,
  params: WriteNotificationParams
): Promise<WriteNotificationResult> {
  // Runtime validation (defense-in-depth — TS literals + DB CHECK cover this too).
  if (!VALID_TYPES.includes(params.type)) {
    return { ok: false, error: `Invalid type: ${params.type}. Must be one of ${VALID_TYPES.join(', ')}` };
  }
  const channel: NotificationChannel = params.channel ?? 'whatsapp';
  if (!VALID_CHANNELS.includes(channel)) {
    return { ok: false, error: `Invalid channel: ${channel}. Must be one of ${VALID_CHANNELS.join(', ')}` };
  }
  if (!params.school_id || !params.title || !params.message || !params.module) {
    return { ok: false, error: 'school_id, title, message, and module are required' };
  }
  if (params.title.length > 200) {
    return { ok: false, error: 'title too long (max 200 chars)' };
  }
  if (params.message.length > 4000) {
    return { ok: false, error: 'message too long (max 4000 chars)' };
  }

  // INSERT. Status defaults to 'pending', attempts defaults to 0, channel via column default
  // is 'whatsapp' but we pass it explicitly for clarity.
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      school_id: params.school_id,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      module: params.module,
      reference_id: params.reference_id ?? null,
      channel,
      // status, attempts, created_at use DB defaults
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, error: `notifications INSERT failed: ${error.message ?? String(error)}` };
  }
  if (!data || !data.id) {
    return { ok: false, error: 'notifications INSERT returned no row' };
  }

  return { ok: true, id: data.id };
}
