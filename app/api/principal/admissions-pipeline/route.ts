// app/api/principal/admissions-pipeline/route.ts
// Item #6 PR #2 — Loop 1: admissions pipeline drill-down.
//
// GET /api/principal/admissions-pipeline
//   Returns inquiries from last 90 days, grouped by status, with computed
//   age (days since created_at). Read-only — Item #5 (admissions team workflow)
//   owns mutations.

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

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('inquiries')
    .select('id, parent_name, child_name, priority, status, score, notes, created_at')
    .eq('school_id', schoolId)
    .gte('created_at', ninetyDaysAgo)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Compute age + group by status
  const now = Date.now();
  const enriched = (data ?? []).map((r) => {
    const ageMs = now - new Date(r.created_at).getTime();
    const ageDays = Math.floor(ageMs / 86400000);
    return { ...r, age_days: ageDays };
  });

  const byStatus: Record<string, { count: number; avg_score: number; oldest_age_days: number; high_priority: number }> = {};
  for (const r of enriched) {
    const status = r.status || 'unknown';
    if (!byStatus[status]) {
      byStatus[status] = { count: 0, avg_score: 0, oldest_age_days: 0, high_priority: 0 };
    }
    byStatus[status].count += 1;
    byStatus[status].avg_score += (r.score ?? 0);
    byStatus[status].oldest_age_days = Math.max(byStatus[status].oldest_age_days, r.age_days);
    if (r.priority === 'high' || r.priority === 'urgent') byStatus[status].high_priority += 1;
  }
  // Finalize avg
  for (const s of Object.keys(byStatus)) {
    if (byStatus[s].count > 0) {
      byStatus[s].avg_score = Math.round(byStatus[s].avg_score / byStatus[s].count);
    }
  }

  const groups = Object.entries(byStatus)
    .map(([status, stats]) => ({ status, ...stats }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    window: { from: ninetyDaysAgo, to: new Date().toISOString() },
    total: enriched.length,
    high_priority_count: enriched.filter((r) => r.priority === 'high' || r.priority === 'urgent').length,
    by_status: groups,
    inquiries: enriched.slice(0, 50), // top 50 most recent for the drill-down
  });
}
