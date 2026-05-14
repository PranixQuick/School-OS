// app/api/parent/report-cards/route.ts
// Batch 9 — Parent view of child marks grouped by term.
// Auth: phone+PIN (same pattern as /api/parent/fees).
// academic_records.subject is TEXT (not UUID) — confirmed in Batch 6.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function calcGrade(pct: number): string {
  if (pct >= 90) return 'A+'; if (pct >= 80) return 'A'; if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B'; if (pct >= 50) return 'C'; if (pct >= 40) return 'D';
  return 'F';
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { phone, pin, term } = body as { phone?: string; pin?: string; term?: string };
  if (!phone || !pin) return NextResponse.json({ error: 'phone and pin are required' }, { status: 400 });

  // Verify parent credentials
  const { data: parent } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id, name')
    .eq('phone', phone)
    .eq('access_pin', pin)
    .maybeSingle();
  if (!parent) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });

  const { schoolId: schoolId, student_id: studentId } = { schoolId: parent.school_id, student_id: parent.student_id };

  // Fetch student info
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('name, class, section, roll_number')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  // Fetch marks
  let query = supabaseAdmin
    .from('academic_records')
    .select('term, subject, marks_obtained, max_marks, grade, exam_date')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .order('term')
    .order('subject');
  if (term) query = query.eq('term', term);
  const { data: marks } = await query;

  // Group by term
  const termMap = new Map<string, { subject: string; marks_obtained: number; max_marks: number; grade: string }[]>();
  for (const m of marks ?? []) {
    const arr = termMap.get(m.term) ?? [];
    arr.push({ subject: m.subject, marks_obtained: Number(m.marks_obtained), max_marks: Number(m.max_marks), grade: m.grade ?? '' });
    termMap.set(m.term, arr);
  }

  const terms = [...termMap.entries()].map(([t, subjects]) => {
    const totalObt = subjects.reduce((s, r) => s + r.marks_obtained, 0);
    const totalMax = subjects.reduce((s, r) => s + r.max_marks, 0);
    const pct = totalMax > 0 ? parseFloat(((totalObt / totalMax) * 100).toFixed(1)) : 0;
    return { term: t, subjects, total_obtained: totalObt, total_max: totalMax, percentage: pct, overall_grade: calcGrade(pct) };
  });

  return NextResponse.json({
    student: { name: student?.name ?? 'N/A', class: student?.class ?? '?', section: student?.section ?? '', roll_number: student?.roll_number ?? null },
    terms,
  });
}
