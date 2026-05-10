import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher fetches their recent homework assignments.
// Auth: phone+PIN per request (Item 9 pattern).
//
// Body: {
//   phone: string,
//   pin: string,
//   class_id?: uuid     // optional filter
//   since_date?: string // YYYY-MM-DD, defaults to 30 days ago IST
// }
//
// Returns homework rows where assigned_by = authenticated teacher.id, ordered newest first.
// Hydrates class + subject + submission summary (counts: pending, graded).

interface ListRequest {
  phone?: string;
  pin?: string;
  class_id?: string;
  since_date?: string;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

function thirtyDaysAgoIST(): string {
  const now = new Date();
  const past = new Date(now.getTime() - 30 * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(past);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as ListRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (body.class_id && !UUID_RX.test(body.class_id)) {
      return NextResponse.json({ error: 'Invalid class_id format' }, { status: 400 });
    }
    if (body.since_date && !DATE_RX.test(body.since_date)) {
      return NextResponse.json({ error: 'Invalid since_date format (expected YYYY-MM-DD)' }, { status: 400 });
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

    const sinceDate = body.since_date ?? thirtyDaysAgoIST();

    // Fetch homework assigned by this teacher in this school.
    let q = supabaseAdmin
      .from('homework')
      .select('id, class_id, subject_id, title, description, due_date, attachments, created_at')
      .eq('assigned_by', teacher.id)
      .eq('school_id', teacher.school_id)
      .gte('due_date', sinceDate)
      .order('due_date', { ascending: false });

    if (body.class_id) q = q.eq('class_id', body.class_id);

    const { data: homeworkRows, error: hErr } = await q.limit(100);

    if (hErr) {
      console.error('Homework list query error:', hErr);
      return NextResponse.json({ error: 'Failed to load homework' }, { status: 500 });
    }

    if (!homeworkRows || homeworkRows.length === 0) {
      return NextResponse.json({ success: true, homework: [], total: 0 });
    }

    // Parallel hydration: classes, subjects, submission counts per homework.
    const classIds = Array.from(new Set(homeworkRows.map(h => h.class_id).filter(Boolean)));
    const subjectIds = Array.from(new Set(homeworkRows.map(h => h.subject_id).filter(Boolean)));
    const homeworkIds = homeworkRows.map(h => h.id);

    const [classesRes, subjectsRes, submissionsRes] = await Promise.all([
      classIds.length > 0
        ? supabaseAdmin.from('classes').select('id, grade_level, section').in('id', classIds)
        : Promise.resolve({ data: [], error: null }),
      subjectIds.length > 0
        ? supabaseAdmin.from('subjects').select('id, name, code').in('id', subjectIds)
        : Promise.resolve({ data: [], error: null }),
      supabaseAdmin.from('homework_submissions')
        .select('homework_id, status')
        .in('homework_id', homeworkIds),
    ]);

    if (classesRes.error)     console.error('classes hydrate error:', classesRes.error);
    if (subjectsRes.error)    console.error('subjects hydrate error:', subjectsRes.error);
    if (submissionsRes.error) console.error('submissions hydrate error:', submissionsRes.error);

    const classMap = new Map((classesRes.data ?? []).map(c => [c.id, c]));
    const subjectMap = new Map((subjectsRes.data ?? []).map(s => [s.id, s]));

    // Submission counts per homework_id.
    // Valid status values: pending | submitted | late | graded | missed.
    const submissionCounts = new Map<string, { total: number; pending: number; graded: number; submitted: number; late: number; missed: number }>();
    for (const s of submissionsRes.data ?? []) {
      const cur = submissionCounts.get(s.homework_id) ?? { total: 0, pending: 0, graded: 0, submitted: 0, late: 0, missed: 0 };
      cur.total += 1;
      if (s.status === 'pending') cur.pending += 1;
      else if (s.status === 'submitted') cur.submitted += 1;
      else if (s.status === 'late') cur.late += 1;
      else if (s.status === 'graded') cur.graded += 1;
      else if (s.status === 'missed') cur.missed += 1;
      submissionCounts.set(s.homework_id, cur);
    }

    const enriched = homeworkRows.map(h => ({
      id: h.id,
      title: h.title,
      description: h.description,
      due_date: h.due_date,
      attachments: h.attachments ?? [],
      created_at: h.created_at,
      class: h.class_id ? classMap.get(h.class_id) ?? null : null,
      subject: h.subject_id ? subjectMap.get(h.subject_id) ?? null : null,
      submissions: submissionCounts.get(h.id) ?? { total: 0, pending: 0, graded: 0, submitted: 0, late: 0, missed: 0 },
    }));

    return NextResponse.json({
      success: true,
      total: enriched.length,
      since_date: sinceDate,
      homework: enriched,
    });

  } catch (err) {
    console.error('Homework list error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
