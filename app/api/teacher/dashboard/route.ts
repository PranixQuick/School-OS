import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireTeacherSession } from '@/lib/teacher-auth';

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);

    const [leaveRes, staffRes] = await Promise.allSettled([
      supabaseAdmin
        .from('teacher_leave_requests')
        .select('id,status')
        .eq('school_id', session.schoolId)
        .eq('staff_id', session.staffId),
      supabaseAdmin
        .from('staff')
        .select('name,school_id')
        .eq('id', session.staffId)
        .single(),
    ]);

    const leaves = leaveRes.status === 'fulfilled' ? (leaveRes.value.data ?? []) : [];
    const staff = staffRes.status === 'fulfilled' ? staffRes.value.data : null;

    const { data: school } = await supabaseAdmin
      .from('schools')
      .select('name')
      .eq('id', session.schoolId)
      .single();

    return NextResponse.json({
      name: staff?.name ?? session.userEmail,
      school_name: school?.name ?? '',
      today_day: new Date().toLocaleDateString('en-IN', { weekday: 'long' }),
      schedule: [],
      recent_homework: [],
      leave_pending: leaves.filter((l: { status: string }) => l.status === 'pending').length,
      leave_approved: leaves.filter((l: { status: string }) => l.status === 'approved').length,
      students_count: 0,
      attendance_today: null,
    });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
