import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createStaffAlerts } from '@/lib/alerts'; // Workflow #11: attendance shortage alerts

// Teacher marks attendance for a class.
// Re-verifies phone + PIN, validates the teacher is assigned to the class via timetable,
// then UPSERTs attendance rows.
//
// IMPORTANT: existing attendance schema is per-student-per-day, NOT per-period.
// UNIQUE constraint is (school_id, student_id, date). The first marking of the day "wins"
// and subsequent markings overwrite. Frontend labels this as "Today's attendance" so the
// teacher understands the day-level granularity.

interface AttendanceMark {
  student_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
}

interface MarkRequest {
  phone: string;
  pin: string;
  class_id: string;
  marks: AttendanceMark[];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as MarkRequest;
    const { phone, pin, class_id, marks } = body;

    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!class_id) {
      return NextResponse.json({ error: 'class_id required' }, { status: 400 });
    }
    if (!Array.isArray(marks) || marks.length === 0) {
      return NextResponse.json({ error: 'marks array required' }, { status: 400 });
    }

    // Re-verify teacher.
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

    // Authorization: teacher must be assigned to this class via timetable for any day.
    // Prevents marking attendance for classes the teacher does not teach.
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

    // Validate every status value before any DB write.
    const validStatuses = new Set(['present', 'absent', 'late', 'excused']);
    for (const m of marks) {
      if (!m.student_id || !validStatuses.has(m.status)) {
        return NextResponse.json({ error: 'Invalid mark entry' }, { status: 400 });
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    // Build attendance rows. school_id from authenticated teacher (NOT from request body)
    // to prevent cross-tenant injection.
    const rows = marks.map(m => ({
      school_id: teacher.school_id,
      student_id: m.student_id,
      date: today,
      status: m.status,
      marked_by: teacher.id,
      marked_via: 'teacher_portal',
      data_source: 'manual',
    }));

    const { data: upserted, error: uErr } = await supabaseAdmin
      .from('attendance')
      .upsert(rows, { onConflict: 'school_id,student_id,date' })
      .select('id, student_id, status');

    if (uErr) {
      console.error('Attendance upsert error:', uErr);
      return NextResponse.json({ error: 'Failed to save attendance' }, { status: 500 });
    }

    await supabaseAdmin.rpc('update_staff_access', { p_staff_id: teacher.id });

    // Workflow #11: attendance shortage. For students marked absent, if their
    // cumulative attendance has fallen below the threshold, alert HOD + Principal.
    // De-duplicated (skip if an unread shortage alert already exists for the
    // student) so it fires on the crossing, not on every subsequent absence.
    try {
      const SHORTAGE_THRESHOLD = 75;
      const MIN_DAYS = 5;
      const absentIds = marks.filter(m => m.status === 'absent').map(m => m.student_id);
      if (absentIds.length) {
        const { data: att } = await supabaseAdmin
          .from('attendance').select('student_id, status')
          .eq('school_id', teacher.school_id).in('student_id', absentIds);
        const agg: Record<string, { total: number; present: number }> = {};
        for (const a of att ?? []) {
          const s = (agg[a.student_id] ??= { total: 0, present: 0 });
          s.total++;
          if (a.status === 'present') s.present++;
        }
        for (const sid of absentIds) {
          const s = agg[sid];
          if (!s || s.total < MIN_DAYS) continue;
          const pct = Math.round((s.present / s.total) * 100);
          if (pct >= SHORTAGE_THRESHOLD) continue;
          const { data: existing } = await supabaseAdmin
            .from('staff_alerts').select('id')
            .eq('school_id', teacher.school_id).eq('type', 'attendance_shortage')
            .eq('reference_id', sid).eq('is_read', false).limit(1).maybeSingle();
          if (existing) continue;
          const { data: stu } = await supabaseAdmin
            .from('students').select('name').eq('id', sid).eq('school_id', teacher.school_id).maybeSingle();
          await createStaffAlerts({
            schoolId: teacher.school_id,
            targetRoles: ['hod', 'principal'],
            type: 'attendance_shortage',
            module: 'attendance',
            title: 'Attendance shortage',
            message: `${stu?.name ?? 'A student'} is at ${pct}% attendance (below ${SHORTAGE_THRESHOLD}%).`,
            referenceId: sid,
          });
        }
      }
    } catch (e) {
      console.error('[attendance] shortage alert failed (non-fatal):', e);
    }

    return NextResponse.json({
      success: true,
      date: today,
      class_id,
      marked_count: upserted?.length ?? 0,
      marks: upserted ?? [],
    });

  } catch (err) {
    console.error('Teacher attendance mark error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
