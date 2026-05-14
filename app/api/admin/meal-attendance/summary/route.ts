// app/api/admin/meal-attendance/summary/route.ts
// Batch 4A — Meal attendance daily summary for reporting period.
// Guard: meal_tracking_enabled
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

  // Feature flag check
  const { data: schoolData } = await supabaseAdmin
    .from('schools').select('institutions(feature_flags)').eq('id', schoolId).maybeSingle();
  const inst = schoolData ? (Array.isArray(schoolData.institutions) ? schoolData.institutions[0] : schoolData.institutions) as { feature_flags?: Record<string, unknown> } | null : null;
  if (!inst?.feature_flags?.meal_tracking_enabled) {
    return NextResponse.json({ error: 'Meal tracking is not enabled for this institution' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10);
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0,10);

  const { data, error } = await supabaseAdmin.rpc('meal_attendance_summary', {
    p_school_id: schoolId, p_from: from, p_to: to
  });

  if (error) {
    // Fallback: aggregate in application if RPC not available
    const { data: rows } = await supabaseAdmin
      .from('meal_attendance').select('date, meal_served')
      .eq('school_id', schoolId).gte('date', from).lte('date', to);

    const byDate: Record<string, { served: number; total: number }> = {};
    for (const r of rows ?? []) {
      if (!byDate[r.date]) byDate[r.date] = { served: 0, total: 0 };
      byDate[r.date].total++;
      if (r.meal_served) byDate[r.date].served++;
    }
    const summary = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, { served, total }]) => ({
      date, meals_served: served, total_enrolled: total,
      coverage_pct: total > 0 ? Math.round((served / total) * 100) : 0,
    }));
    return NextResponse.json({ from, to, summary });
  }

  return NextResponse.json({ from, to, summary: data });
}
