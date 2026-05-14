// app/api/admin/ops/summary/route.ts
// Batch 12 — Single-call ops health summary.
// cron_runs has school_id column (confirmed schema-first).
// Returns notification queue, cron last runs, payment stats, AI briefing status.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const [notifRes, notif24hRes, notifFailRes, cronRes, feesRes, briefingRes] = await Promise.allSettled([
    // Notification counts by status
    supabaseAdmin.from('notifications').select('status')
      .eq('school_id', schoolId),
    // Dispatched in last 24h
    supabaseAdmin.from('notifications').select('id')
      .eq('school_id', schoolId).eq('status', 'dispatched')
      .gte('dispatched_at', since24h),
    // Recent failures (last 5)
    supabaseAdmin.from('notifications')
      .select('id, type, module, dispatch_error, created_at')
      .eq('school_id', schoolId).eq('status', 'failed')
      .order('created_at', { ascending: false }).limit(5),
    // Cron: latest run per job_name
    supabaseAdmin.from('cron_runs').select('job_name, status, started_at, duration_ms, error')
      .eq('school_id', schoolId)
      .order('started_at', { ascending: false }).limit(50),
    // Fee stats
    supabaseAdmin.from('fees').select('status, refund_status')
      .eq('school_id', schoolId),
    // Most recent principal briefing
    supabaseAdmin.from('cron_runs')
      .select('status, started_at, error')
      .eq('school_id', schoolId).eq('job_name', 'principal_briefing')
      .order('started_at', { ascending: false }).limit(1),
  ]);

  // Notification stats
  const notifAll = notifRes.status === 'fulfilled' ? (notifRes.value.data ?? []) : [];
  const notifCounts = notifAll.reduce<Record<string, number>>((acc, n) => {
    acc[n.status] = (acc[n.status] ?? 0) + 1;
    return acc;
  }, {});
  const dispatched24h = notif24hRes.status === 'fulfilled' ? (notif24hRes.value.data?.length ?? 0) : 0;
  const recentFailures = notifFailRes.status === 'fulfilled' ? (notifFailRes.value.data ?? []) : [];

  // Cron: deduplicate to latest per job
  const cronAll = cronRes.status === 'fulfilled' ? (cronRes.value.data ?? []) : [];
  const cronLatest = new Map<string, typeof cronAll[0]>();
  for (const row of cronAll) {
    if (!cronLatest.has(row.job_name)) cronLatest.set(row.job_name, row);
  }

  // Fee stats
  const feesAll = feesRes.status === 'fulfilled' ? (feesRes.value.data ?? []) : [];
  const feeCounts = feesAll.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});
  const refundProcessing = feesAll.filter(f => f.refund_status === 'processing').length;

  // AI briefing
  const briefingLast = briefingRes.status === 'fulfilled'
    ? (briefingRes.value.data?.[0] ?? null)
    : null;

  return NextResponse.json({
    notifications: {
      pending: notifCounts['pending'] ?? 0,
      dispatched_24h: dispatched24h,
      awaiting_template: notifCounts['awaiting_template'] ?? 0,
      failed: notifCounts['failed'] ?? 0,
      skipped: notifCounts['skipped'] ?? 0,
      recent_failures: recentFailures,
    },
    cron: [...cronLatest.values()].map(c => ({
      job_name: c.job_name,
      last_status: c.status,
      last_run: c.started_at,
      last_duration_ms: c.duration_ms,
      last_error: c.error,
    })),
    payments: {
      online_paid: feeCounts['paid'] ?? 0,
      pending_verification: feeCounts['pending_verification'] ?? 0,
      overdue: feeCounts['overdue'] ?? 0,
      refund_processing: refundProcessing,
    },
    ai_briefings: {
      last_generated: briefingLast?.started_at ?? null,
      last_status: briefingLast?.status ?? null,
      last_error: briefingLast?.error ?? null,
    },
  });
}
