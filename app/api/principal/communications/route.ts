// app/api/principal/communications/route.ts
// Item #6 Principal Dashboard — Loop 5: parent communications visibility.
//
// GET /api/principal/communications — notifications from last 7 days grouped by
//   module (homework, fees, attendance, broadcast, alert, etc) + last-24h count.
// Read-only summary. No send-from-principal action — Item #5 owns sending.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requirePrincipalSession(req); }
  catch (e) {
    if (e instanceof PrincipalAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, module, channel, status, created_at')
    .eq('school_id', schoolId)
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by module
  const byModule: Record<string, { total: number; last_24h: number; channels: Record<string, number>; statuses: Record<string, number> }> = {};
  let totalLast24h = 0;
  let totalLast7d = 0;

  for (const n of data ?? []) {
    totalLast7d += 1;
    const within24h = n.created_at >= twentyFourHoursAgo;
    if (within24h) totalLast24h += 1;

    const moduleKey = n.module || 'unknown'; // renamed from module — avoids @next/next/no-assign-module-variable
    if (!byModule[moduleKey]) {
      byModule[moduleKey] = { total: 0, last_24h: 0, channels: {}, statuses: {} };
    }
    byModule[moduleKey].total += 1;
    if (within24h) byModule[moduleKey].last_24h += 1;

    if (n.channel) {
      byModule[moduleKey].channels[n.channel] = (byModule[moduleKey].channels[n.channel] || 0) + 1;
    }
    if (n.status) {
      byModule[moduleKey].statuses[n.status] = (byModule[moduleKey].statuses[n.status] || 0) + 1;
    }
  }

  // Sort modules by total desc
  const groups = Object.entries(byModule)
    .map(([moduleKey, stats]) => ({ module: moduleKey, ...stats }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json({
    window: { from: sevenDaysAgo, to: new Date().toISOString() },
    total_last_24h: totalLast24h,
    total_last_7d: totalLast7d,
    by_module: groups,
  });
}
