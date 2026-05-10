import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher fetches their own substitute assignments for today.
// Auth: phone+PIN per request (Item 9 pattern).
// Returns assignments where substitute_staff_id = teacher.id and assigned_at within
// today's IST window. Each assignment joined to original class + subject + original
// teacher's name for context.

interface MyAssignmentsRequest { phone: string; pin: string; }

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

export async function POST(req: NextRequest) {
  try {
    const { phone, pin } = await req.json() as MyAssignmentsRequest;
    if (!phone || !pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }

    // Re-auth teacher.
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

    const { dayStart, dayEnd } = todayInIST();

    // Fetch assignments for this teacher today.
    const { data: assignments, error: aErr } = await supabaseAdmin
      .from('substitute_assignments')
      .select('id, original_staff_id, original_class_id, original_period_id, reason, status, assigned_at, accepted_at')
      .eq('school_id', teacher.school_id)
      .eq('substitute_staff_id', teacher.id)
      .gte('assigned_at', dayStart)
      .lt('assigned_at', dayEnd)
      .order('assigned_at', { ascending: false });

    if (aErr) {
      console.error('Assignments fetch error:', aErr);
      return NextResponse.json({ error: 'Failed to load assignments' }, { status: 500 });
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    // Hydrate original_staff names, class info, period info.
    const staffIds = [...new Set(assignments.map(a => a.original_staff_id).filter(Boolean))];
    const classIds = [...new Set(assignments.map(a => a.original_class_id).filter(Boolean))];
    const periodIds = [...new Set(assignments.map(a => a.original_period_id).filter(Boolean))];

    const [staffRes, classesRes, periodsRes] = await Promise.all([
      staffIds.length > 0
        ? supabaseAdmin.from('staff').select('id, name, subject').in('id', staffIds)
        : Promise.resolve({ data: [], error: null }),
      classIds.length > 0
        ? supabaseAdmin.from('classes').select('id, grade_level, section').in('id', classIds)
        : Promise.resolve({ data: [], error: null }),
      periodIds.length > 0
        ? supabaseAdmin.from('timetable').select('id, period, start_time, end_time, subject_id').in('id', periodIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const staffById = new Map((staffRes.data ?? []).map(s => [s.id, s]));
    const classById = new Map((classesRes.data ?? []).map(c => [c.id, c]));
    const periodById = new Map((periodsRes.data ?? []).map(p => [p.id, p]));

    // Hydrate subjects from periods.
    const subjectIds = [...new Set((periodsRes.data ?? []).map(p => p.subject_id).filter(Boolean))];
    const { data: subjects } = subjectIds.length > 0
      ? await supabaseAdmin.from('subjects').select('id, name, code').in('id', subjectIds)
      : { data: [] };
    const subjectById = new Map((subjects ?? []).map(s => [s.id, s]));

    const enriched = assignments.map(a => {
      const orig = a.original_staff_id ? staffById.get(a.original_staff_id) : null;
      const cls = a.original_class_id ? classById.get(a.original_class_id) : null;
      const per = a.original_period_id ? periodById.get(a.original_period_id) : null;
      const subj = per?.subject_id ? subjectById.get(per.subject_id) : null;
      return {
        id: a.id,
        status: a.status,
        reason: a.reason,
        assigned_at: a.assigned_at,
        accepted_at: a.accepted_at,
        original_teacher: orig ? { name: orig.name, subject: orig.subject } : null,
        class: cls ? { grade_level: cls.grade_level, section: cls.section } : null,
        period: per ? { period: per.period, start_time: per.start_time, end_time: per.end_time } : null,
        subject: subj ? { name: subj.name, code: subj.code } : null,
      };
    });

    return NextResponse.json({ success: true, assignments: enriched });

  } catch (err) {
    console.error('My assignments error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
