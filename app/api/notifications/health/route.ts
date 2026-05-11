import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Item 14a — notifications dispatcher health endpoint.
// Auth: session cookie via getSchoolId(req) (Item 10 principal pattern).
//
// GET /api/notifications/health
//
// Returns aggregated counts for principal dashboard health card:
//   - pending_count
//   - dispatched_last_24h
//   - failed_last_24h
//   - skipped_dry_run_count (most recent 24h)
//   - oldest_pending_age_sec
//   - latest_dispatched_at
//   - dispatcher_mode (from server-side env at runtime, default 'unknown')
//
// Pure JS aggregation, mirrors Item 10's teacher-presence parallel-queries pattern.
//
// Item 14b will add a UI card that consumes this endpoint. The endpoint ships
// in 14a so the API surface is ready when the UI lands.

interface HealthSummary {
  pending_count: number;
  dispatched_last_24h: number;
  failed_last_24h: number;
  skipped_dry_run_count: number;
  oldest_pending_age_sec: number | null;
  latest_dispatched_at: string | null;
  dispatcher_mode: string;
  fetched_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    // Compute 24h-ago timestamp for filtering.
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 5 parallel queries, all scoped by school_id (cross-tenant guard via authenticated session).
    const [
      pendingRes,
      dispatchedRes,
      failedRes,
      skippedRes,
      oldestPendingRes,
      latestDispatchedRes,
    ] = await Promise.all([
      // 1. Pending count (all-time, anything not yet processed)
      supabaseAdmin.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'pending'),

      // 2. Dispatched last 24h
      supabaseAdmin.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'dispatched')
        .gte('dispatched_at', twentyFourHoursAgo),

      // 3. Failed last 24h
      supabaseAdmin.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'failed')
        .gte('last_attempt_at', twentyFourHoursAgo),

      // 4. Skipped (dry_run mode) last 24h — uses created_at because skipped rows
      //    in dry-run set dispatched_at to NULL.
      supabaseAdmin.from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'skipped')
        .gte('created_at', twentyFourHoursAgo),

      // 5. Oldest pending — for SLO monitoring (queue not draining = problem)
      supabaseAdmin.from('notifications')
        .select('created_at')
        .eq('school_id', schoolId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),

      // 6. Latest dispatched — for "is the dispatcher running" sanity check
      supabaseAdmin.from('notifications')
        .select('dispatched_at')
        .eq('school_id', schoolId)
        .eq('status', 'dispatched')
        .order('dispatched_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Log any errors but don't fail the whole endpoint — return whatever counts we got.
    if (pendingRes.error) console.error('pending count error:', pendingRes.error);
    if (dispatchedRes.error) console.error('dispatched count error:', dispatchedRes.error);
    if (failedRes.error) console.error('failed count error:', failedRes.error);
    if (skippedRes.error) console.error('skipped count error:', skippedRes.error);
    if (oldestPendingRes.error) console.error('oldest pending error:', oldestPendingRes.error);
    if (latestDispatchedRes.error) console.error('latest dispatched error:', latestDispatchedRes.error);

    // Compute oldest_pending_age_sec.
    let oldestPendingAgeSec: number | null = null;
    if (oldestPendingRes.data && oldestPendingRes.data.created_at) {
      const ageMs = now.getTime() - new Date(oldestPendingRes.data.created_at).getTime();
      oldestPendingAgeSec = Math.floor(ageMs / 1000);
    }

    // Dispatcher mode is set as an env var on the Edge Function, but for the Next.js
    // API route to surface it, the same env var needs to be set on Vercel too — OR
    // we expose a separate "mode" endpoint that the dispatcher itself reports.
    // For Item 14a MVP: read process.env.NOTIFICATIONS_DISPATCH_MODE if set; else 'unknown'.
    const dispatcherMode = process.env.NOTIFICATIONS_DISPATCH_MODE ?? 'unknown';

    const summary: HealthSummary = {
      pending_count: pendingRes.count ?? 0,
      dispatched_last_24h: dispatchedRes.count ?? 0,
      failed_last_24h: failedRes.count ?? 0,
      skipped_dry_run_count: skippedRes.count ?? 0,
      oldest_pending_age_sec: oldestPendingAgeSec,
      latest_dispatched_at: latestDispatchedRes.data?.dispatched_at ?? null,
      dispatcher_mode: dispatcherMode,
      fetched_at: now.toISOString(),
    };

    return NextResponse.json({ success: true, ...summary });

  } catch (err) {
    console.error('Notifications health error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
