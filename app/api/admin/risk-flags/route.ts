// app/api/admin/risk-flags/route.ts
// Batch 5 — Get active student risk flags.
// GET: returns unreviewed flags joined with student name/class, high risk first.
// Schema: student_risk_flags.risk_factors (jsonb) = directive's risk_reasons.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return { schoolId: (await requireAdminSession(req)).schoolId }; }
  catch (e) {
    if (!(e instanceof AdminAuthError)) throw e;
    try { return { schoolId: (await requirePrincipalSession(req)).schoolId }; }
    catch (pe) { if (pe instanceof PrincipalAuthError) return null; throw pe; }
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;

  // Fetch unreviewed flags
  const { data: flags, error } = await supabaseAdmin
    .from('student_risk_flags')
    .select('id, student_id, risk_level, risk_factors, ai_summary, flagged_at, auto_generated')
    .eq('school_id', schoolId)
    .eq('reviewed', false)
    .order('flagged_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!flags || flags.length === 0) return NextResponse.json({ flags: [], count: 0, high_risk: 0, medium_risk: 0 });

  // Enrich with student names
  const studentIds = flags.map(f => f.student_id);
  const { data: students } = await supabaseAdmin
    .from('students').select('id, name, class, section')
    .in('id', studentIds).eq('school_id', schoolId);
  const studentMap = new Map((students ?? []).map(s => [s.id, s]));

  const enriched = flags
    .map(f => ({
      ...f,
      risk_reasons: f.risk_factors, // alias for UI consistency
      student_name: studentMap.get(f.student_id)?.name ?? 'Unknown',
      student_class: studentMap.get(f.student_id)?.class ?? null,
      student_section: studentMap.get(f.student_id)?.section ?? null,
    }))
    .sort((a, b) => {
      const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3);
    });

  return NextResponse.json({
    flags: enriched,
    count: enriched.length,
    high_risk: enriched.filter(f => f.risk_level === 'high').length,
    medium_risk: enriched.filter(f => f.risk_level === 'medium').length,
  });
}
