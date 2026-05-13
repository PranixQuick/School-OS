// app/api/admin/report-cards/[student_id]/route.ts
// Batch 6 — Get marks summary for a student + generate PDF on demand.
// GET: ?term=term_1
// Returns marks summary; triggers generation if requested.
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ student_id: string }> }
) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;
  const { student_id } = await params;
  const term = req.nextUrl.searchParams.get('term');
  if (!term) return NextResponse.json({ error: 'term is required' }, { status: 400 });

  const { data: marks, error } = await supabaseAdmin
    .from('academic_records')
    .select('subject, marks_obtained, max_marks, grade, exam_type, exam_date')
    .eq('school_id', schoolId)
    .eq('student_id', student_id)
    .eq('term', term)
    .order('subject');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalObtained = (marks ?? []).reduce((s, r) => s + Number(r.marks_obtained ?? 0), 0);
  const totalMax = (marks ?? []).reduce((s, r) => s + Number(r.max_marks ?? 0), 0);
  const percentage = totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(1)) : 0;

  return NextResponse.json({ student_id, term, marks: marks ?? [], total_obtained: totalObtained, total_max: totalMax, percentage });
}
