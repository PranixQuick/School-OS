// app/api/admin/observability/route.ts
// Batch 4 — Observability dashboard API.
// Returns a single health payload: notifications, payments, cron jobs, errors, DB.
//
// Schema adaptations (pre-checks confirmed existing tables differ from directive):
//   error_logs: uses route/error/details (not source/message/stack/metadata)
//   cron_runs:  uses job_name/status/started_at/completed_at/error (not cron_run_log)
//
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try {
    const ctx = await requireAdminSession(req);
    return { schoolId: ctx.schoolId };
  } catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try {
      const ctx = await requirePrincipalSession(req);
      return { schoolId: ctx.schoolId };
    } catch (pe) {
      if (pe instanceof PrincipalAuthError) return null;
      throw pe;
    }
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;
  const checkedAt = new Date().toISOString();

  // ── 1. Notification health ─────────────────────────────────────────────────
  const { data: notifRows } = await supabaseAdmin
    .from('notifications')
    .select('status, created_at')
    .eq('school_id', schoolId);

  const notifCounts: Record<string, number> = { pending: 0, dispatched: 0, failed: 0, awaiting_template: 0, skipped: 0 };
  let stuckPending = 0;
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  for (const n of notifRows ?? []) {
    const s = n.status ?? 'pending';
    notifCounts[s] = (notifCounts[s] ?? 0) + 1;
    if (s === 'pending' && n.created_at < tenMinutesAgo) stuckPending++;
  }

  // Recent failures (last 5)
  const { data: recentFailures } = await supabaseAdmin
    .from('notifications')
    .select('id, type, title, dispatch_error, created_at')
    .eq('school_id', schoolId)
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(5);

  // ── 2. Payment health ──────────────────────────────────────────────────────
  const { data: feeRows } = await supabaseAdmin
    .from('fees')
    .select('status, payment_method')
    .eq('school_id', schoolId);

  let onlinePaid = 0, pendingVerification = 0, overdue = 0;
  for (const f of feeRows ?? []) {
    if (f.payment_method === 'online' && f.status === 'paid') onlinePaid++;
    if (f.status === 'pending_verification') pendingVerification++;
    if (f.status === 'overdue') overdue++;
  }

  // ── 3. Cron health (from cron_runs — school-agnostic) ────────────────────
  const { data: cronRows } = await supabaseAdmin
    .from('cron_runs')
    .select('job_name, status, started_at, completed_at, error, duration_ms')
    .order('started_at', { ascending: false })
    .limit(20);

  // ── 4. Recent errors (school-scoped + global) ─────────────────────────────
  // error_logs uses: route (→source), error (→message), details (→metadata)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: errorRows } = await supabaseAdmin
    .from('error_logs')
    .select('route, error, details, created_at')
    .or(`school_id.eq.${schoolId},school_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(10);

  const { count: errorCount24h } = await supabaseAdmin
    .from('error_logs')
    .select('id', { count: 'exact', head: true })
    .or(`school_id.eq.${schoolId},school_id.is.null`)
    .gte('created_at', oneDayAgo);

  // ── 5. DB health ───────────────────────────────────────────────────────────
  let dbOk = false;
  try {
    const { error } = await supabaseAdmin.from('schools').select('id').limit(1);
    dbOk = !error;
  } catch { dbOk = false; }

  return NextResponse.json({
    checked_at: checkedAt,
    notifications: {
      pending: notifCounts.pending ?? 0,
      dispatched: notifCounts.dispatched ?? 0,
      failed: notifCounts.failed ?? 0,
      awaiting_template: notifCounts.awaiting_template ?? 0,
      skipped: notifCounts.skipped ?? 0,
      stuck_pending: stuckPending,
      recent_failures: recentFailures ?? [],
    },
    payments: {
      online_paid: onlinePaid,
      pending_verification: pendingVerification,
      overdue,
    },
    cron_jobs: (cronRows ?? []).map(r => ({
      job_name: r.job_name,
      status: r.status,
      started_at: r.started_at,
      completed_at: r.completed_at,
      duration_ms: r.duration_ms,
      error_message: r.error ?? null,
    })),
    errors: {
      last_24h_count: errorCount24h ?? 0,
      recent: (errorRows ?? []).map(r => ({
        source: r.route ?? 'unknown',
        message: typeof r.error === 'string' ? r.error.slice(0, 200) : String(r.error ?? '').slice(0, 200),
        created_at: r.created_at,
      })),
    },
    health: { db_ok: dbOk },
  });
}
