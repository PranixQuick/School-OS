import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher schedule refresh: re-verifies phone + PIN, returns today's schedule.
// Used for refresh / day-change. Same shape as login response's `schedule` field.
export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json() as { phone: string; pin: string };

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
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
      schedule: schedule ?? [],
      day_of_week: dow,
    });

  } catch (err) {
    console.error('Teacher schedule error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
