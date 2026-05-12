// app/api/teacher/me/route.ts
// Item #1 Track C — Teacher Dashboard (OPTION_1_TRACK_C_ITEM_1_TEACHER_DASHBOARD).
//
// GET /api/teacher/me — returns the teacher's staff profile + today summary.
//
// Auth: session-based via requireTeacherSession (replaces phone+PIN-per-request).
// Returns 401 if no session, 403 if not a teacher, 403 if account misconfigured.
//
// Response shape (success):
//   {
//     staff: { id, name, subject, role, phone, email },
//     today: {
//       date: "YYYY-MM-DD",
//       attendance_status: "present" | "absent" | "leave" | null,
//       periods_count: number,
//       pending_homework_count: number,
//       lesson_plans_today_count: number
//     }
//   }

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireTeacherSession, TeacherAuthError } from '@/lib/teacher-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// IST day-of-week (0=Sunday) — used for timetable lookup
function istToday(): { date: string; dow: number } {
  // IST = UTC+5:30
  const now = new Date();
  const istMs = now.getTime() + (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(istMs);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(ist.getUTCDate()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, dow: ist.getUTCDay() };
}

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireTeacherSession(req);
  } catch (e) {
    if (e instanceof TeacherAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { staffId, schoolId } = ctx;
  const today = istToday();

  // Five parallel queries
  const [staffRes, attRes, periodsRes, homeworkRes, lpRes] = await Promise.all([
    supabaseAdmin
      .from('staff')
      .select('id, name, subject, role, phone, email')
      .eq('id', staffId)
      .eq('school_id', schoolId)
      .single(),
    supabaseAdmin
      .from('teacher_attendance')
      .select('status')
      .eq('staff_id', staffId)
      .eq('school_id', schoolId)
      .eq('date', today.date)
      .maybeSingle(),
    supabaseAdmin
      .from('timetable')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('school_id', schoolId)
      .eq('day_of_week', today.dow),
    supabaseAdmin
      .from('homework')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_by', staffId)
      .eq('school_id', schoolId)
      .gte('due_date', today.date),
    supabaseAdmin
      .from('lesson_plans')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('school_id', schoolId)
      .eq('planned_date', today.date),
  ]);

  if (staffRes.error || !staffRes.data) {
    return NextResponse.json({ error: 'Staff record not found' }, { status: 404 });
  }

  return NextResponse.json({
    staff: staffRes.data,
    today: {
      date: today.date,
      attendance_status: attRes.data?.status ?? null,
      periods_count: periodsRes.count ?? 0,
      pending_homework_count: homeworkRes.count ?? 0,
      lesson_plans_today_count: lpRes.count ?? 0,
    },
  });
}
