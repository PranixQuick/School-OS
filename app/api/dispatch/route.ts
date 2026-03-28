import { NextRequest, NextResponse } from 'next/server';
import { getSchoolId } from '@/lib/getSchoolId';
import { processPendingNotifications } from '@/lib/dispatcher';
import { supabaseAdmin } from '@/lib/supabaseClient';

// POST: Manually trigger dispatch for this school's pending notifications
export async function POST(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { limit = 20 } = await req.json().catch(() => ({})) as { limit?: number };

    const result = await processPendingNotifications(schoolId, { limit });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('Dispatch error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET: Return dispatch stats and recent log for this school
export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);

    const [statsRes, logRes, pendingRes] = await Promise.all([
      // Notification status counts
      supabaseAdmin
        .from('notifications')
        .select('status')
        .eq('school_id', schoolId),

      // Recent dispatch log
      supabaseAdmin
        .from('dispatch_log')
        .select('id, channel, recipient, status, provider, error, attempted_at, notification_id')
        .eq('school_id', schoolId)
        .order('attempted_at', { ascending: false })
        .limit(30),

      // Pending count
      supabaseAdmin
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('status', 'pending'),
    ]);

    const notifications = statsRes.data ?? [];
    const stats = {
      total: notifications.length,
      pending: notifications.filter(n => n.status === 'pending').length,
      dispatched: notifications.filter(n => n.status === 'dispatched').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      skipped: notifications.filter(n => n.status === 'skipped').length,
    };

    return NextResponse.json({
      stats,
      pending_count: pendingRes.count ?? 0,
      recent_log: logRes.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
