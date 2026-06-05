// app/api/parent/timetable/route.ts
// Cert-D fix — Parent timetable read.
// Auth: getParentSession (phone+pin cookie, same as parent/dashboard).
// Resolves class_id from classes table via student.class + student.section.
// Response shape aligned to app/parent/timetable/page.tsx Slot interface:
//   { day: string; period: number; subject: string; staff_name?: string; start_time?: string; end_time?: string }

import { NextRequest, NextResponse } from 'next/server';
import { getParentSession } from '@/lib/parent-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { schoolId, studentId } = session;

  // Resolve student's class + section from students table
  const { data: student } = await supabaseAdmin
    .from('students')
    .select('class, section')
    .eq('id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!student) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
  }

  // Resolve class_id (same pattern as /api/student/timetable)
  const { data: classRow } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    .eq('grade_level', student.class)
    .eq('section', student.section)
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

  // Map to the shape expected by app/parent/timetable/page.tsx
  const timetable = (data ?? []).map(t => {
    const subj = Array.isArray(t.subjects) ? t.subjects[0] : t.subjects as { name?: string } | null;
    const teacher = Array.isArray(t.staff) ? t.staff[0] : t.staff as { name?: string } | null;
    return {
      day:        DAY_NAMES[t.day_of_week] ?? String(t.day_of_week),
      period:     t.period,
      subject:    subj?.name ?? '—',
      staff_name: teacher?.name ?? undefined,
      start_time: t.start_time ?? undefined,
      end_time:   t.end_time ?? undefined,
    };
  });

  return NextResponse.json({ timetable });
}
