import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Parent fetches their student's class lesson plans for the current week.
// Auth: phone+PIN per request.
//
// Body: { phone, pin }  (no params — always current Mon-Sun IST per PRE-FLIGHT-D)
//
// completion_status enum (DB CHECK): planned | in_progress | completed | skipped.
//
// Approach:
//   1. Re-auth parent
//   2. Resolve student's class_id via classes table grade_level+section join
//      (Spawn 7 #1 — students.class is TEXT)
//   3. If class_id is null (classes table empty), return empty result gracefully
//   4. Query lesson_plans WHERE class_id = $class_id AND planned_date IN [monday, sunday]
//   5. Hydrate with subject info

interface LPRequest {
  phone?: string;
  pin?: string;
}

function nowInIST(): { dateStr: string; dow: number } {
  const now = new Date();
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const dowName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', weekday: 'short',
  }).format(now);
  const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(dowName);
  return { dateStr, dow };
}

function getMondayOfCurrentWeekIST(): string {
  const { dateStr, dow } = nowInIST();
  const d = new Date(dateStr + 'T00:00:00+05:30');
  // Days back to Monday: Sun=6, Mon=0, Tue=1, ..., Sat=5.
  const back = (dow + 6) % 7;
  const monday = new Date(d.getTime() - back * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(monday);
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  const shifted = new Date(d.getTime() + days * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(shifted);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as LPRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }

    // Re-auth parent (multi-tenant guard).
    const { data: parents, error: pErr } = await supabaseAdmin
      .from('parents')
      .select('id, school_id, student_id')
      .eq('phone', body.phone)
      .eq('access_pin', body.pin);

    if (pErr) {
      console.error('Parent lookup error:', pErr);
      return NextResponse.json({ error: 'Failed to verify credentials' }, { status: 500 });
    }
    if (!parents || parents.length === 0) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }
    if (parents.length > 1) {
      return NextResponse.json({
        error: 'Multiple accounts match this phone. Please contact your school admin.',
      }, { status: 409 });
    }
    const parent = parents[0];

    // Resolve student's class_id from classes table.
    const { data: student, error: sErr } = await supabaseAdmin
      .from('students')
      .select('class, section')
      .eq('id', parent.student_id)
      .eq('school_id', parent.school_id)
      .single();

    if (sErr || !student) {
      console.error('Student lookup error:', sErr);
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const weekStart = getMondayOfCurrentWeekIST();
    const weekEnd = shiftDate(weekStart, 6);  // Sunday

    if (!student.class || !student.section) {
      return NextResponse.json({
        success: true,
        week_start: weekStart,
        week_end: weekEnd,
        class_id: null,
        message: 'Student class not configured',
        total: 0,
        plans: [],
      });
    }

    const { data: classRow } = await supabaseAdmin
      .from('classes')
      .select('id')
      .eq('school_id', parent.school_id)
      .eq('grade_level', student.class)
      .eq('section', student.section)
      .maybeSingle();

    if (!classRow) {
      // Acknowledged Spawn 7 #1: classes table may be empty. Degrade gracefully.
      return NextResponse.json({
        success: true,
        week_start: weekStart,
        week_end: weekEnd,
        class_id: null,
        message: 'No class record found for this student. Lesson plans unavailable until classes table is seeded.',
        total: 0,
        plans: [],
      });
    }

    // Fetch lesson_plans for this class in the current week.
    const { data: plans, error: lpErr } = await supabaseAdmin
      .from('lesson_plans')
      .select('id, subject_id, planned_date, completion_status, completed_at, notes')
      .eq('class_id', classRow.id)
      .eq('school_id', parent.school_id)
      .gte('planned_date', weekStart)
      .lte('planned_date', weekEnd)
      .order('planned_date', { ascending: true })
      .limit(100);

    if (lpErr) {
      console.error('Lesson plans query error:', lpErr);
      return NextResponse.json({ error: 'Failed to load lesson plans' }, { status: 500 });
    }

    const lpRows = plans ?? [];
    const subjectIds = Array.from(new Set(lpRows.map(p => p.subject_id).filter(Boolean)));

    let subjectMap = new Map<string, { id: string; name: string; code: string }>();
    if (subjectIds.length > 0) {
      const { data: subjects } = await supabaseAdmin
        .from('subjects')
        .select('id, name, code')
        .in('id', subjectIds);
      subjectMap = new Map((subjects ?? []).map(s => [s.id, s]));
    }

    const enriched = lpRows.map(p => ({
      id: p.id,
      planned_date: p.planned_date,
      completion_status: p.completion_status,
      completed_at: p.completed_at,
      notes: p.notes,
      subject: p.subject_id ? subjectMap.get(p.subject_id) ?? null : null,
    }));

    // Summary across the week.
    const summary = {
      planned: enriched.filter(p => p.completion_status === 'planned').length,
      in_progress: enriched.filter(p => p.completion_status === 'in_progress').length,
      completed: enriched.filter(p => p.completion_status === 'completed').length,
      skipped: enriched.filter(p => p.completion_status === 'skipped').length,
    };

    return NextResponse.json({
      success: true,
      week_start: weekStart,
      week_end: weekEnd,
      class_id: classRow.id,
      total: enriched.length,
      summary,
      plans: enriched,
    });

  } catch (err) {
    console.error('Parent lesson-plans error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
