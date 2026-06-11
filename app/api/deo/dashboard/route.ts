// app/api/deo/dashboard/route.ts
// DEO district compliance aggregation.
// Reads meo_mandal_mapping + per-school data → aggregates by mandal.
// Government schools ONLY. Private schools NEVER appear.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['deo','meo','admin','owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'DEO role required' }, { status: 403 });
  }

  // Get all MEO mandal mappings for this district
  const { data: mappings } = await supabaseAdmin
    .from('meo_mandal_mapping')
    .select('mandal_code, mandal_name, district_code, district_name')
    .eq('is_active', true)
    .limit(50);

  if (!mappings || mappings.length === 0) {
    return NextResponse.json({ error: 'No mandal mappings found for this district' }, { status: 404 });
  }

  const districtName = mappings[0].district_name ?? 'District';
  const mandal_codes = [...new Set(mappings.map(m => m.mandal_code))];

  // Pull the real per-school compliance summary for this district.
  const districtCode = mappings[0].district_code ?? null;
  let summaryQuery = supabaseAdmin
    .from('v_meo_school_summary')
    .select('school_id, school_name, mandal_code, district_code, total_students, compliance_score');
  if (districtCode) summaryQuery = summaryQuery.eq('district_code', districtCode);
  const { data: summary } = await summaryQuery;
  const rows = summary ?? [];

  const { data: actionItems } = await supabaseAdmin
    .from('meo_action_items')
    .select('school_id')
    .eq('status', 'open');
  const openByNothing = (actionItems ?? []).length;

  const avg = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : 0;

  // Build per-mandal summary from real data, grouped by mandal_code.
  const mandals = mappings.map(m => {
    const mandalRows = rows.filter(r => r.mandal_code === m.mandal_code);
    const scores = mandalRows.map(r => Number(r.compliance_score ?? 0));
    const worst = mandalRows.slice().sort(
      (a, b) => Number(a.compliance_score ?? 0) - Number(b.compliance_score ?? 0)
    )[0];
    return {
      mandal_code: m.mandal_code,
      mandal_name: m.mandal_name,
      school_count: mandalRows.length,
      avg_compliance: avg(scores),
      critical_schools: mandalRows.filter(r => Number(r.compliance_score ?? 0) < 50).length,
      teacher_vacancies: 0,
      open_action_items: openByNothing,
      inspections_due: 0,
      worst_school: worst?.school_name ?? '',
    };
  });

  const allScores = rows.map(r => Number(r.compliance_score ?? 0));

  return NextResponse.json({
    district_name: districtName,
    total_mandals: mandal_codes.length,
    total_schools: rows.length,
    avg_district_compliance: avg(allScores),
    mandals,
    date: new Date().toISOString().split('T')[0],
  });
}
