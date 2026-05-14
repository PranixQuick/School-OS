// app/api/student/marks/route.ts
// Batch 4D — Student marks view.
// academic_records.subject is text (not FK) — no subjects join.

import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession, studentAuthResponse } from '@/lib/student-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireStudentSession(req); }
  catch (e) { return studentAuthResponse(e); }

  const { studentId, schoolId } = session;

  const { data, error } = await supabaseAdmin
    .from('academic_records')
    .select('id, term, subject, marks_obtained, max_marks, grade, teacher_remarks, exam_date')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .order('term', { ascending: true })
    .order('subject', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by term for accordion UI
  const byTerm: Record<string, typeof data> = {};
  for (const r of data ?? []) {
    if (!byTerm[r.term]) byTerm[r.term] = [];
    byTerm[r.term]!.push(r);
  }

  // Term summaries
  const terms = Object.entries(byTerm).map(([term, records]) => {
    const valid = records.filter(r => r.marks_obtained != null && r.max_marks != null && r.max_marks > 0);
    const totalObtained = valid.reduce((s, r) => s + Number(r.marks_obtained), 0);
    const totalMax = valid.reduce((s, r) => s + Number(r.max_marks), 0);
    const pct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : null;
    return { term, records, total_percentage: pct };
  });

  return NextResponse.json({ terms, total_subjects: (data ?? []).length });
}
