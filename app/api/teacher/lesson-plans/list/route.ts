import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher fetches their lesson plans in a date range.
// Auth: phone+PIN per request.
//
// Body: {
//   phone, pin: required
//   since_date?: YYYY-MM-DD (default 30 days ago IST)
//   until_date?: YYYY-MM-DD (default 30 days from now IST)
// }
//
// Returns lesson_plans where staff_id = teacher.id within the date range,
// hydrated with class + subject context, ordered by planned_date ascending.
//
// completion_status enum (DB CHECK): planned | in_progress | completed | skipped.

interface ListRequest {
  phone?: string;
  pin?: string;
  since_date?: string;
  until_date?: string;
}

const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

function shiftDateIST(daysFromNow: number): string {
  const target = new Date(Date.now() + daysFromNow * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(target);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ListRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (body.since_date && !DATE_RX.test(body.since_date)) {
      return NextResponse.json({ error: 'Invalid since_date format (YYYY-MM-DD)' }, { status: 400 });
    }
    if (body.until_date && !DATE_RX.test(body.until_date)) {
      return NextResponse.json({ error: 'Invalid until_date format (YYYY-MM-DD)' }, { status: 400 });
    }

    const sinceDate = body.since_date ?? shiftDateIST(-30);
    const untilDate = body.until_date ?? shiftDateIST(30);

    if (sinceDate > untilDate) {
      return NextResponse.json({ error: 'since_date cannot be after until_date' }, { status: 400 });
    }

    // Re-auth teacher.
    const { data: teacher, error: tErr } = await supabaseAdmin
      .from('staff')
      .select('id, school_id, role, is_active')
      .eq('phone', body.phone)
      .eq('access_pin', body.pin)
      .eq('is_active', true)
      .single();

    if (tErr || !teacher) {
      return NextResponse.json({ error: 'Invalid phone number or PIN' }, { status: 401 });
    }

    // Fetch lesson_plans for this teacher in the range.
    const { data: lpRows, error: lpErr } = await supabaseAdmin
      .from('lesson_plans')
      .select('id, class_id, subject_id, topic_id, planned_date, completion_status, completed_at, notes')
      .eq('staff_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .gte('planned_date', sinceDate)
      .lte('planned_date', untilDate)
      .order('planned_date', { ascending: true })
      .limit(500);

    if (lpErr) {
      console.error('Lesson plans list query error:', lpErr);
      return NextResponse.json({ error: 'Failed to load lesson plans' }, { status: 500 });
    }

    if (!lpRows || lpRows.length === 0) {
      return NextResponse.json({
        success: true,
        since_date: sinceDate,
        until_date: untilDate,
        total: 0,
        plans: [],
        summary: { planned: 0, in_progress: 0, completed: 0, skipped: 0 },
      });
    }

    // Hydrate classes + subjects.
    const classIds = Array.from(new Set(lpRows.map(p => p.class_id).filter(Boolean)));
    const subjectIds = Array.from(new Set(lpRows.map(p => p.subject_id).filter(Boolean)));

    const [classesRes, subjectsRes] = await Promise.all([
      classIds.length > 0
        ? supabaseAdmin.from('classes').select('id, grade_level, section').in('id', classIds)
        : Promise.resolve({ data: [], error: null }),
      subjectIds.length > 0
        ? supabaseAdmin.from('subjects').select('id, name, code').in('id', subjectIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (classesRes.error)  console.error('classes hydrate error:', classesRes.error);
    if (subjectsRes.error) console.error('subjects hydrate error:', subjectsRes.error);

    const classMap = new Map((classesRes.data ?? []).map(c => [c.id, c]));
    const subjectMap = new Map((subjectsRes.data ?? []).map(s => [s.id, s]));

    const enriched = lpRows.map(p => ({
      id: p.id,
      planned_date: p.planned_date,
      completion_status: p.completion_status,
      completed_at: p.completed_at,
      notes: p.notes,
      topic_id: p.topic_id,
      class: p.class_id ? classMap.get(p.class_id) ?? null : null,
      subject: p.subject_id ? subjectMap.get(p.subject_id) ?? null : null,
    }));

    // Summary across the range.
    const summary = {
      planned: enriched.filter(p => p.completion_status === 'planned').length,
      in_progress: enriched.filter(p => p.completion_status === 'in_progress').length,
      completed: enriched.filter(p => p.completion_status === 'completed').length,
      skipped: enriched.filter(p => p.completion_status === 'skipped').length,
    };

    return NextResponse.json({
      success: true,
      since_date: sinceDate,
      until_date: untilDate,
      total: enriched.length,
      summary,
      plans: enriched,
    });

  } catch (err) {
    console.error('Lesson plans list error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
