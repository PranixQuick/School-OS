import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher portal: verify by phone + PIN, return today's schedule.
// Mirrors /api/parent/student auth pattern: phone + access_pin direct lookup,
// throttled last_access stamp via update_staff_access RPC, all in one round-trip.
//
// Auth model (Item 9 MVP):
//   - No session cookies. Each subsequent /api/teacher/* call re-verifies phone + PIN.
//   - Frontend stores teacher_id + school_id in component state, NOT cookies.
//   - Future Item can upgrade to session cookies once teacher count justifies it.
export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json() as { phone: string; pin: string };

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }

    const { data: teacher, error: tErr } = await supabaseAdmin
      .from('staff')
      .select('id, school_id, name, role, subject, phone')
      .eq('phone', phone)
      .eq('access_pin', pin)
      .eq('is_active', true)
      .single();

    if (tErr || !teacher) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Throttled last_access update — prevents write storms on rapid reloads (1-min window).
    await supabaseAdmin.rpc('update_staff_access', { p_staff_id: teacher.id });

    // Today's schedule: classes assigned to this teacher for the current day-of-week.
    // Postgres EXTRACT(DOW FROM ...) returns 0-6 (Sun-Sat); timetable.day_of_week uses same.
    const dow = new Date().getDay();

    const { data: schedule, error: sErr } = await supabaseAdmin
      .from('timetable')
      .select(`
        id,
        period,
        day_of_week,
        start_time,
        end_time,
        classes:class_id ( id, grade_level, section ),
        subjects:subject_id ( id, code, name )
      `)
      .eq('staff_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .eq('day_of_week', dow)
      .order('period', { ascending: true });

    if (sErr) {
      console.error('Teacher schedule fetch error:', sErr);
      return NextResponse.json({ error: 'Failed to load schedule' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      teacher: {
        id: teacher.id,
        school_id: teacher.school_id,
        name: teacher.name,
        role: teacher.role,
        subject: teacher.subject,
      },
      schedule: schedule ?? [],
      day_of_week: dow,
    });

  } catch (err) {
    console.error('Teacher login error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
