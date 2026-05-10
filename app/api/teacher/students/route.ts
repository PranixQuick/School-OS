import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher fetches the student list for a class they teach.
// Re-verifies phone + PIN, confirms the teacher is assigned to the class via timetable,
// returns students plus today's existing attendance status (so the UI can pre-fill).
//
// Used by the attendance-marking screen.
export async function POST(req: NextRequest) {
  try {
    const { phone, pin, class_id } = await req.json() as {
      phone: string;
      pin: string;
      class_id: string;
    };

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!class_id) {
      return NextResponse.json({ error: 'class_id required' }, { status: 400 });
    }

    const { data: teacher, error: tErr } = await supabaseAdmin
      .from('staff')
      .select('id, school_id')
      .eq('phone', phone)
      .eq('access_pin', pin)
      .eq('is_active', true)
      .single();

    if (tErr || !teacher) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Authorization: teacher must be assigned to this class via timetable.
    const { count: assignmentCount, error: aErr } = await supabaseAdmin
      .from('timetable')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', teacher.id)
      .eq('class_id', class_id)
      .eq('school_id', teacher.school_id);

    if (aErr) {
      console.error('Teacher class assignment check error:', aErr);
      return NextResponse.json({ error: 'Failed to verify assignment' }, { status: 500 });
    }
    if (!assignmentCount || assignmentCount === 0) {
      return NextResponse.json({ error: 'Not authorized for this class' }, { status: 403 });
    }

    // Class details + students. The student-to-class linkage in the existing schema is via
    // students.class + students.section (NOT students.class_id — students table predates
    // the Item 6 classes table). So we fetch class details first, then look up students by
    // (school_id, class=grade_level, section).
    const { data: classRow, error: cErr } = await supabaseAdmin
      .from('classes')
      .select('id, grade_level, section')
      .eq('id', class_id)
      .eq('school_id', teacher.school_id)
      .single();

    if (cErr || !classRow) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const [studentsRes, attendanceRes] = await Promise.all([
      supabaseAdmin
        .from('students')
        .select('id, name, roll_number, admission_number')
        .eq('school_id', teacher.school_id)
        .eq('class', classRow.grade_level)
        .eq('section', classRow.section)
        .order('roll_number', { ascending: true, nullsFirst: false }),

      supabaseAdmin
        .from('attendance')
        .select('student_id, status')
        .eq('school_id', teacher.school_id)
        .eq('date', today),
    ]);

    if (studentsRes.error) {
      console.error('Students fetch error:', studentsRes.error);
      return NextResponse.json({ error: 'Failed to load students' }, { status: 500 });
    }

    // Map of student_id -> today's existing status, for UI pre-fill.
    const todayStatus = new Map<string, string>();
    for (const a of attendanceRes.data ?? []) {
      todayStatus.set(a.student_id, a.status);
    }

    const students = (studentsRes.data ?? []).map(s => ({
      id: s.id,
      name: s.name,
      roll_number: s.roll_number,
      admission_number: s.admission_number,
      todays_status: todayStatus.get(s.id) ?? null,
    }));

    return NextResponse.json({
      success: true,
      class: { id: classRow.id, grade_level: classRow.grade_level, section: classRow.section },
      students,
      date: today,
    });

  } catch (err) {
    console.error('Teacher students error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
