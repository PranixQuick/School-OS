import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

// Principal lists periods needing a substitute today.
// Auth: session cookie via getSchoolId.
//
// Sources of "needs sub":
//   - Open teacher_late_events (resolved_at IS NULL) for today (IST half-open interval)
// Each row joins to the late teacher's staff record + scheduled period from timetable
// (via scheduled_period_id) for class/subject context.
//
// Returns: { needs: Array<{
//   late_event_id, expected_at, delta_minutes, original_staff: {id, name, subject, phone},
//   period: {id, period, day_of_week, start_time, end_time},
//   class: {id, grade_level, section} | null,
//   subject: {id, name, code} | null
// }> }

function todayInIST(): { dayStart: string; dayEnd: string } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const tomorrowDate = new Date(new Date(`${dateStr}T00:00:00+05:30`).getTime() + 86400000);
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(tomorrowDate);
  return {
    dayStart: `${dateStr}T00:00:00+05:30`,
    dayEnd: `${tomorrowStr}T00:00:00+05:30`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const schoolId = getSchoolId(req);
    const { dayStart, dayEnd } = todayInIST();

    // Step 1: open late events for this school today.
    const { data: lateEvents, error: leErr } = await supabaseAdmin
      .from('teacher_late_events')
      .select('id, staff_id, scheduled_period_id, expected_at, delta_minutes')
      .eq('school_id', schoolId)
      .is('resolved_at', null)
      .gte('expected_at', dayStart)
      .lt('expected_at', dayEnd)
      .order('expected_at', { ascending: true });

    if (leErr) {
      console.error('Late events fetch error:', leErr);
      return NextResponse.json({ error: 'Failed to load late events' }, { status: 500 });
    }

    if (!lateEvents || lateEvents.length === 0) {
      return NextResponse.json({ success: true, needs: [] });
    }

    // Step 2: collect referenced staff_ids and period_ids; fetch in parallel.
    const staffIds = [...new Set(lateEvents.map(e => e.staff_id).filter(Boolean))];
    const periodIds = [...new Set(lateEvents.map(e => e.scheduled_period_id).filter(Boolean))];

    const [staffRes, periodsRes] = await Promise.all([
      supabaseAdmin.from('staff')
        .select('id, name, subject, phone')
        .in('id', staffIds.length > 0 ? staffIds : ['00000000-0000-0000-0000-000000000000']),
      periodIds.length > 0
        ? supabaseAdmin.from('timetable')
            .select('id, period, day_of_week, start_time, end_time, class_id, subject_id')
            .in('id', periodIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (staffRes.error) {
      console.error('Staff lookup error:', staffRes.error);
      return NextResponse.json({ error: 'Failed to load teacher details' }, { status: 500 });
    }
    if (periodsRes.error) {
      console.error('Timetable lookup error:', periodsRes.error);
      return NextResponse.json({ error: 'Failed to load period details' }, { status: 500 });
    }

    const staffById = new Map((staffRes.data ?? []).map(s => [s.id, s]));
    const periodById = new Map((periodsRes.data ?? []).map(p => [p.id, p]));

    // Step 3: collect class_ids and subject_ids from the periods we found, fetch in parallel.
    const classIds = [...new Set((periodsRes.data ?? []).map(p => p.class_id).filter(Boolean))];
    const subjectIds = [...new Set((periodsRes.data ?? []).map(p => p.subject_id).filter(Boolean))];

    const [classesRes, subjectsRes] = await Promise.all([
      classIds.length > 0
        ? supabaseAdmin.from('classes').select('id, grade_level, section').in('id', classIds)
        : Promise.resolve({ data: [], error: null }),
      subjectIds.length > 0
        ? supabaseAdmin.from('subjects').select('id, name, code').in('id', subjectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const classById = new Map((classesRes.data ?? []).map(c => [c.id, c]));
    const subjectById = new Map((subjectsRes.data ?? []).map(s => [s.id, s]));

    // Step 4: assemble result.
    const needs = lateEvents.map(e => {
      const period = e.scheduled_period_id ? periodById.get(e.scheduled_period_id) : null;
      const cls = period?.class_id ? classById.get(period.class_id) : null;
      const subj = period?.subject_id ? subjectById.get(period.subject_id) : null;
      const teacher = staffById.get(e.staff_id);
      return {
        late_event_id: e.id,
        expected_at: e.expected_at,
        delta_minutes: e.delta_minutes,
        original_staff: teacher
          ? { id: teacher.id, name: teacher.name, subject: teacher.subject, phone: teacher.phone }
          : null,
        period: period
          ? { id: period.id, period: period.period, day_of_week: period.day_of_week, start_time: period.start_time, end_time: period.end_time }
          : null,
        class: cls ? { id: cls.id, grade_level: cls.grade_level, section: cls.section } : null,
        subject: subj ? { id: subj.id, name: subj.name, code: subj.code } : null,
      };
    });

    return NextResponse.json({ success: true, needs });

  } catch (err) {
    console.error('Substitute list-needed error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
