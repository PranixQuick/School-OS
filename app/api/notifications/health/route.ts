import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Item 14a — notifications dispatcher health endpoint.
// GET /api/notifications/health
// Returns aggregated notification counts for principal dashboard health card.

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
  let schoolId: string;
  try {
    schoolId = getSchoolId(req);
  } catch {
    // MissingSchoolIdError — unauthenticated request.
    // Layout.tsx calls this for the WhatsApp health badge — graceful 401.
    return NextResponse.json({ error: 'No session', dispatcher_mode: 'unknown' }, { status: 401 });
  }

  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const [
      pendingRes, dispatchedRes, failedRes, skippedRes, oldestPendingRes, latestDispatchedRes,
    ] = await Promise.all([
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'dispatched').gte('dispatched_at', twentyFourHoursAgo),
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'failed').gte('last_attempt_at', twentyFourHoursAgo),
      supabaseAdmin.from('notifications').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'skipped').gte('created_at', twentyFourHoursAgo),
      supabaseAdmin.from('notifications').select('created_at').eq('school_id', schoolId).eq('status', 'pending').order('created_at', { ascending: true }).limit(1).maybeSingle(),
      supabaseAdmin.from('notifications').select('dispatched_at').eq('school_id', schoolId).eq('status', 'dispatched').order('dispatched_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    let oldestPendingAgeSec: number | null = null;
    if (oldestPendingRes.data?.created_at) {
      oldestPendingAgeSec = Math.floor((now.getTime() - new Date(oldestPendingRes.data.created_at).getTime()) / 1000);
    }

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
