// app/api/admin/security/analytics/route.ts
// Security analytics for admin dashboard.
// Returns: auth health, blocked IPs count, top threats, recent failure count.
// Admin/owner only.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'owner', 'principal'].includes(session.userRole)) {
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  }

  // Run all queries in parallel
  const [healthRes, threatsRes, blockedRes, hourlyRes] = await Promise.all([
    // Auth health for this school
    supabaseAdmin
      .from('v_school_auth_health')
      .select('successes_24h, failures_24h, success_rate_pct')
      .eq('school_id', session.schoolId)
      .maybeSingle(),
    // Top threat IPs (last 7 days)
    supabaseAdmin
      .from('v_ip_threat_scores')
      .select('ip, total_failures, last_attempt, threat_level, distinct_accounts_tried')
      .order('total_failures', { ascending: false })
      .limit(10),
    // Total blocked IPs
    supabaseAdmin
      .from('blocked_ips')
      .select('ip', { count: 'exact', head: true })
      .gt('blocked_until', new Date().toISOString()),
    // Failures in last hour
    supabaseAdmin
      .from('auth_events')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', session.schoolId)
      .eq('event_type', 'login_failure')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()),
  ]);

  return NextResponse.json({
    auth_health: healthRes.data ?? { successes_24h: 0, failures_24h: 0, success_rate_pct: 100 },
    blocked_ips_total: blockedRes.count ?? 0,
    top_threats: threatsRes.data ?? [],
    failures_last_hour: hourlyRes.count ?? 0,
    generated_at: new Date().toISOString(),
  });
}
