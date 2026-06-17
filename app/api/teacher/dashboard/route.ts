import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireTeacherSession } from '@/lib/teacher-auth';

interface TTRow {
  day_of_week: number;
  period: number;
  start_time: string | null;
  end_time: string | null;
  class_id: string | null;
  subject_id: string | null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireTeacherSession(req);
    const schoolId = session.schoolId;
    const staffId = session.staffId;

    // JS getDay(): 0=Sun..6=Sat. This matches Mon-Sat in both 0-indexed
    // (Sun=0) and 1-indexed (Mon=1) timetable conventions; only Sunday
    // differs, so accept both 0 and 7 for Sunday.
    const jsDay = new Date().getDay();
    const dayCandidates = jsDay === 0 ? [0, 7] : [jsDay];

    const [leaveRes, staffRes, schoolRes, ttRes] = await Promise.allSettled([
      supabaseAdmin
        .from('teacher_leave_requests')
        .select('id,status')
        .eq('school_id', schoolId)
        .eq('staff_id', staffId),
      supabaseAdmin
        .from('staff')
        .select('name')
        .eq('id', staffId)
        .single(),
      supabaseAdmin
        .from('schools')
        .select('name')
        .eq('id', schoolId)
        .single(),
      supabaseAdmin
        .from('timetable')
        .select('day_of_week, period, start_time, end_time, class_id, subject_id')
        .eq('school_id', schoolId)
        .eq('staff_id', staffId)
        .order('day_of_week')
        .order('period'),
    ]);

    const leaves = leaveRes.status === 'fulfilled' ? (leaveRes.value.data ?? []) : [];
    const staff = staffRes.status === 'fulfilled' ? staffRes.value.data : null;
    const school = schoolRes.status === 'fulfilled' ? schoolRes.value.data : null;
    const periods: TTRow[] = ttRes.status === 'fulfilled' ? ((ttRes.value.data as TTRow[]) ?? []) : [];

    // Resolve the class + subject names referenced by the teacher's periods.
    const classIds = Array.from(new Set(periods.map(p => p.class_id).filter((x): x is string => !!x)));
    const subjectIds = Array.from(new Set(periods.map(p => p.subject_id).filter((x): x is string => !!x)));

    let classRows: { id: string; grade_level: string; section: string }[] = [];
    if (classIds.length) {
      const r = await supabaseAdmin.from('classes').select('id, grade_level, section').in('id', classIds);
      classRows = (r.data as { id: string; grade_level: string; section: string }[]) ?? [];
    }
    let subjRows: { id: string; name: string }[] = [];
    if (subjectIds.length) {
      const r = await supabaseAdmin.from('subjects').select('id, name').in('id', subjectIds);
      subjRows = (r.data as { id: string; name: string }[]) ?? [];
    }

    const classMap = new Map<string, { grade_level: string; section: string }>();
    for (const c of classRows) classMap.set(c.id, { grade_level: c.grade_level, section: c.section });
    const subjMap = new Map<string, string>();
    for (const s of subjRows) subjMap.set(s.id, s.name);

    const classLabel = (id: string | null): string => {
      const c = id ? classMap.get(id) : null;
      return c ? `${c.grade_level}-${c.section}` : '';
    };

    // Today's schedule (empty on days with no periods — that is correct).
    const schedule = periods
      .filter(p => dayCandidates.includes(p.day_of_week))
      .map(p => ({
        time: (p.start_time ?? '').slice(0, 5),
        class: classLabel(p.class_id),
        subject: (p.subject_id ? subjMap.get(p.subject_id) : '') ?? '',
        period: p.period,
      }));

    // Distinct classes the teacher teaches across the week — used for the
    // student count (day-independent so the dashboard is never empty).
    const pairs = new Map<string, { grade_level: string; section: string }>();
    for (const p of periods) {
      const c = p.class_id ? classMap.get(p.class_id) : null;
      if (c && c.grade_level != null && c.section != null) {
        pairs.set(`${c.grade_level}|${c.section}`, c);
      }
    }

    let students_count = 0;
    for (const c of pairs.values()) {
      const r = await supabaseAdmin
        .from('students')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .eq('class', c.grade_level)
        .eq('section', c.section);
      students_count += r.count ?? 0;
    }

    return NextResponse.json({
      name: staff?.name ?? '',
      school_name: school?.name ?? '',
      today_day: new Date().toLocaleDateString('en-IN', { weekday: 'long' }),
      schedule,
      classes_count: pairs.size,
      recent_homework: [],
      leave_pending: leaves.filter((l: { status: string }) => l.status === 'pending').length,
      leave_approved: leaves.filter((l: { status: string }) => l.status === 'approved').length,
      students_count,
      attendance_today: null,
    });
  } catch (e: unknown) {
    const err = e as { status?: number };
    if (err?.status === 401) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
