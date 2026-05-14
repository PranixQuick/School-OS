// app/api/student/homework/route.ts
// Batch 4D — Student homework list (view-only).
// homework.class_id is a FK to classes — must join via classes table.
// academic_records.subject is text (no FK) — no join needed there.

import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession, studentAuthResponse } from '@/lib/student-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireStudentSession(req); }
  catch (e) { return studentAuthResponse(e); }

  const { studentId, schoolId, studentClass, section } = session;
  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status') ?? 'all';

  // Resolve class_id
  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    .eq('grade_level', studentClass)
    .eq('section', section)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ homework: [], note: 'Class not configured' });
  }

  // Fetch homework for class
  const { data: homeworkList, error } = await supabaseAdmin
    .from('homework')
    .select('id, title, description, due_date, attachments, subjects(name)')
    .eq('school_id', schoolId)
    .eq('class_id', classRow.id)
    .order('due_date', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch this student's submissions for these homework IDs
  const hwIds = (homeworkList ?? []).map(h => h.id);
  let submissionMap: Record<string, { status: string; marks_obtained: number | null; teacher_remarks: string | null }> = {};
  if (hwIds.length) {
    const { data: subs } = await supabaseAdmin
      .from('homework_submissions')
      .select('homework_id, status, marks_obtained, teacher_remarks')
      .eq('student_id', studentId)
      .in('homework_id', hwIds);
    submissionMap = Object.fromEntries(
      (subs ?? []).map(s => [s.homework_id, { status: s.status, marks_obtained: s.marks_obtained, teacher_remarks: s.teacher_remarks }])
    );
  }

  let result = (homeworkList ?? []).map(h => {
    const subj = Array.isArray(h.subjects) ? h.subjects[0] : h.subjects as { name?: string } | null;
    const sub = submissionMap[h.id];
    return {
      id: h.id, title: h.title, description: h.description, due_date: h.due_date,
      subject_name: subj?.name ?? '—',
      submission_status: sub?.status ?? null,
      marks_obtained: sub?.marks_obtained ?? null,
      teacher_remarks: sub?.teacher_remarks ?? null,
      is_overdue: h.due_date < new Date().toISOString().slice(0, 10) && !sub,
    };
  });

  if (statusFilter === 'pending') result = result.filter(h => !h.submission_status);
  else if (statusFilter === 'submitted') result = result.filter(h => h.submission_status);

  return NextResponse.json({ homework: result, count: result.length });
}
