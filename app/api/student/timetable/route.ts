// app/api/student/timetable/route.ts
// Batch 4D — Student timetable.
// Resolves class_id from classes table via grade_level + section (matching parent auth pattern).
// Joins to subjects and staff for display names.

import { NextRequest, NextResponse } from 'next/server';
import { requireStudentSession, studentAuthResponse } from '@/lib/student-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let session;
  try { session = await requireStudentSession(req); }
  catch (e) { return studentAuthResponse(e); }

  const { studentId, schoolId, studentClass, section } = session;

  // Resolve class_id (best-effort, matches parent login pattern)
  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    .eq('grade_level', studentClass)
    .eq('section', section)
    .maybeSingle();

  if (!classRow) {
    return NextResponse.json({ timetable: [], note: 'Class not configured yet' });
  }

  const { data, error } = await supabaseAdmin
    .from('timetable')
    .select('id, day_of_week, period, start_time, end_time, subjects(name, code), staff(name)')
    .eq('school_id', schoolId)
    .eq('class_id', classRow.id)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const timetable = (data ?? []).map(t => {
    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects as { name?: string; code?: string } | null;
    const teacher = Array.isArray(t.staff) ? t.staff[0] : t.staff as { name?: string } | null;
    return {
      id: t.id, day_of_week: t.day_of_week, period: t.period,
      start_time: t.start_time, end_time: t.end_time,
      subject_name: subj?.name ?? '—', subject_code: subj?.code ?? '',
      teacher_name: teacher?.name ?? '—',
    };
  });

  return NextResponse.json({ timetable });
}
