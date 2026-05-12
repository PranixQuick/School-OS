import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { writeNotification } from '@/lib/notifications';

// Teacher creates a homework assignment for a class.
// Auth: phone+PIN per request.
//
// Body: {
//   phone, pin: required
//   class_id: uuid required
//   subject_id?: uuid
//   title: string required
//   description?: string
//   due_date: YYYY-MM-DD required (date type, must be >= today IST)
//   attachments?: string[]  // URLs (no file uploads in Item 12)
// }
//
// Authorization: teacher must be assigned to this class via timetable
// (any timetable row matching staff_id+school_id+class_id is sufficient).
//
// Side effect: auto-create homework_submissions rows for all active students in the class
// using upsert with ignoreDuplicates:true. The UNIQUE(homework_id, student_id) constraint
// makes this idempotent on retry. If submission auto-create fails, the homework row
// is still committed (best-effort per PRE-FLIGHT-A).
//
// students.class is TEXT (not FK to classes.id). To find students for a class:
//   WHERE students.class = classes.grade_level
//     AND students.section = classes.section
//     AND students.school_id = classes.school_id

interface CreateRequest {
  phone?: string;
  pin?: string;
  class_id?: string;
  subject_id?: string;
  title?: string;
  description?: string;
  due_date?: string;
  attachments?: string[];
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CreateRequest;

    // Validate.
    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!body.class_id || !UUID_RX.test(body.class_id)) {
      return NextResponse.json({ error: 'Valid class_id required' }, { status: 400 });
    }
    if (body.subject_id && !UUID_RX.test(body.subject_id)) {
      return NextResponse.json({ error: 'Invalid subject_id format' }, { status: 400 });
    }
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
    }
    if (body.title.length > 200) {
      return NextResponse.json({ error: 'title too long (max 200 chars)' }, { status: 400 });
    }
    if (body.description && body.description.length > 4000) {
      return NextResponse.json({ error: 'description too long (max 4000 chars)' }, { status: 400 });
    }
    if (!body.due_date || !DATE_RX.test(body.due_date)) {
      return NextResponse.json({ error: 'Valid due_date required (YYYY-MM-DD)' }, { status: 400 });
    }
    const today = todayIST();
    if (body.due_date < today) {
      return NextResponse.json({ error: 'due_date cannot be in the past' }, { status: 400 });
    }
    if (body.attachments !== undefined) {
      if (!Array.isArray(body.attachments)) {
        return NextResponse.json({ error: 'attachments must be an array of URLs' }, { status: 400 });
      }
      if (body.attachments.length > 20) {
        return NextResponse.json({ error: 'attachments capped at 20 URLs' }, { status: 400 });
      }
      for (const url of body.attachments) {
        if (typeof url !== 'string' || url.length > 1000) {
          return NextResponse.json({ error: 'each attachment must be a string URL <=1000 chars' }, { status: 400 });
        }
      }
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
    if (teacher.role !== 'teacher') {
      return NextResponse.json({ error: 'Only teachers can create homework' }, { status: 403 });
    }

    // Authorization: verify teacher is assigned to this class via timetable.
    const { data: ttRows, error: ttErr } = await supabaseAdmin
      .from('timetable')
      .select('id')
      .eq('staff_id', teacher.id)
      .eq('school_id', teacher.school_id)
      .eq('class_id', body.class_id)
      .limit(1);

    if (ttErr) {
      console.error('Timetable authz lookup error:', ttErr);
      return NextResponse.json({ error: 'Failed to verify class assignment' }, { status: 500 });
    }
    if (!ttRows || ttRows.length === 0) {
      return NextResponse.json({ error: 'You are not assigned to this class' }, { status: 403 });
    }

    // Look up class metadata for the student-by-text-match lookup.
    const { data: classRow, error: cErr } = await supabaseAdmin
      .from('classes')
      .select('id, school_id, grade_level, section')
      .eq('id', body.class_id)
      .eq('school_id', teacher.school_id)  // cross-tenant guard
      .single();

    if (cErr || !classRow) {
      return NextResponse.json({ error: 'Class not found in your school' }, { status: 404 });
    }

    // INSERT homework row. assigned_by from authenticated teacher.
    const { data: homework, error: hErr } = await supabaseAdmin
      .from('homework')
      .insert({
        school_id: teacher.school_id,
        class_id: body.class_id,
        subject_id: body.subject_id ?? null,
        assigned_by: teacher.id,
        title: body.title.trim(),
        description: body.description?.trim() ?? null,
        due_date: body.due_date,
        attachments: body.attachments ?? [],
      })
      .select('id, created_at, due_date')
      .single();

    if (hErr || !homework) {
      console.error('Homework INSERT error:', hErr);
      return NextResponse.json({ error: 'Failed to create homework' }, { status: 500 });
    }

    // Best-effort: auto-create homework_submissions rows for all active students in this class.
    // If this fails, log and continue — homework row already committed.
    let submissionsCreated = 0;
    let submissionsFailed = false;

    const { data: students, error: sErr } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('school_id', classRow.school_id)
      .eq('class', classRow.grade_level)
      .eq('section', classRow.section)
      .eq('is_active', true);

    if (sErr) {
      console.error('Students lookup error (auto-create skipped):', sErr);
      submissionsFailed = true;
    } else if (students && students.length > 0) {
      // Build INSERT rows with status='pending' (the default + valid CHECK enum value).
      const subRows = students.map(s => ({
        homework_id: homework.id,
        student_id: s.id,
        status: 'pending' as const,
      }));

      // Use upsert with ignoreDuplicates:true to leverage UNIQUE(homework_id, student_id).
      // Note: supabase-js v2 .select() after .upsert() doesn't accept count/head options
      // (the chain return type is RowOrNull, not a count-capable builder). We use
      // subRows.length for the "submissions targeted" count instead. On retry with
      // ignoreDuplicates, the actual NEW row count from the response would be lower,
      // but that distinction isn't useful for the MVP "stubs created" indicator.
      const { error: subErr } = await supabaseAdmin
        .from('homework_submissions')
        .upsert(subRows, { onConflict: 'homework_id,student_id', ignoreDuplicates: true });

      if (subErr) {
        console.error('Auto-create submissions error:', subErr);
        // Spawn 7 inheritance: plumb to founder_alerts via engine API.
        submissionsFailed = true;
      } else {
        submissionsCreated = subRows.length;
      }
    }

    // Item 14a: Best-effort notification write. Failure is non-fatal — homework is already committed.
    try {
      const notifResult = await writeNotification(supabaseAdmin, {
        school_id: teacher.school_id,
        type: 'homework_assigned',
        title: `New homework: ${body.title.trim()}`,
        message: `New homework for Class ${classRow.grade_level}${classRow.section ? '-' + classRow.section : ''}: ${body.title.trim()}. Due: ${homework.due_date}.`,
        module: 'homework_created',
        reference_id: homework.id,
      });
      if (!notifResult.ok) {
        console.error('Notification write failed (non-fatal):', notifResult.error);
      }
    } catch (notifErr) {
      console.error('Notification write threw (non-fatal):', notifErr);
    }

    return NextResponse.json({
      success: true,
      homework_id: homework.id,
      created_at: homework.created_at,
      due_date: homework.due_date,
      submissions_auto_created: submissionsCreated,
      submissions_auto_create_failed: submissionsFailed,
      students_in_class: students?.length ?? 0,
    });

  } catch (err) {
    console.error('Homework create error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
