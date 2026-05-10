import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher fetches all submissions for a single homework assignment.
// Auth: phone+PIN per request.
//
// Body: { phone, pin, homework_id }
//
// Authorization: the homework row must belong to school_id of authenticated teacher
// AND be assigned_by = teacher.id (only the assigning teacher can grade).
//
// Returns submissions joined with student names, sorted by status (pending first)
// then by student name.

interface SubmissionsRequest {
  phone?: string;
  pin?: string;
  homework_id?: string;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Order: pending first (action needed), then submitted (action needed), then late (action needed),
// then graded (already done), then missed (closed). Valid enum: pending, submitted, late, graded, missed.
const STATUS_RANK: Record<string, number> = {
  pending: 0,
  submitted: 1,
  late: 2,
  graded: 3,
  missed: 4,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as SubmissionsRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!body.homework_id || !UUID_RX.test(body.homework_id)) {
      return NextResponse.json({ error: 'Valid homework_id required' }, { status: 400 });
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

    // Authorization: homework must belong to this teacher.
    const { data: homework, error: hErr } = await supabaseAdmin
      .from('homework')
      .select('id, school_id, class_id, subject_id, title, due_date, assigned_by')
      .eq('id', body.homework_id)
      .eq('school_id', teacher.school_id)
      .eq('assigned_by', teacher.id)
      .maybeSingle();

    if (hErr) {
      console.error('Homework auth lookup error:', hErr);
      return NextResponse.json({ error: 'Failed to load homework' }, { status: 500 });
    }
    if (!homework) {
      return NextResponse.json({ error: 'Homework not found or not assigned by you' }, { status: 404 });
    }

    // Fetch submissions + students in parallel.
    const [submissionsRes, classRes] = await Promise.all([
      supabaseAdmin.from('homework_submissions')
        .select('id, student_id, status, submitted_at, marks_obtained, teacher_remarks, attachments')
        .eq('homework_id', homework.id),
      supabaseAdmin.from('classes')
        .select('id, grade_level, section')
        .eq('id', homework.class_id)
        .maybeSingle(),
    ]);

    if (submissionsRes.error) {
      console.error('Submissions fetch error:', submissionsRes.error);
      return NextResponse.json({ error: 'Failed to load submissions' }, { status: 500 });
    }

    const submissions = submissionsRes.data ?? [];
    const studentIds = submissions.map(s => s.student_id);

    let studentMap = new Map<string, { id: string; name: string; parent_name: string | null }>();
    if (studentIds.length > 0) {
      const { data: studentsData, error: stErr } = await supabaseAdmin
        .from('students')
        .select('id, name, parent_name')
        .in('id', studentIds)
        .eq('school_id', teacher.school_id);  // cross-tenant guard

      if (stErr) {
        console.error('Students hydrate error:', stErr);
      } else {
        studentMap = new Map((studentsData ?? []).map(s => [s.id, s]));
      }
    }

    // Enrich + sort.
    const enriched = submissions.map(s => ({
      id: s.id,
      student: studentMap.get(s.student_id) ?? { id: s.student_id, name: 'Unknown student', parent_name: null },
      status: s.status,
      submitted_at: s.submitted_at,
      marks_obtained: s.marks_obtained,
      teacher_remarks: s.teacher_remarks,
      attachments: s.attachments ?? [],
    }));

    enriched.sort((a, b) => {
      const rankDiff = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      return a.student.name.localeCompare(b.student.name);
    });

    // Summary counts.
    const summary = {
      total: enriched.length,
      pending: enriched.filter(s => s.status === 'pending').length,
      submitted: enriched.filter(s => s.status === 'submitted').length,
      late: enriched.filter(s => s.status === 'late').length,
      graded: enriched.filter(s => s.status === 'graded').length,
      missed: enriched.filter(s => s.status === 'missed').length,
    };

    return NextResponse.json({
      success: true,
      homework: {
        id: homework.id,
        title: homework.title,
        due_date: homework.due_date,
        class: classRes.data ?? null,
      },
      summary,
      submissions: enriched,
    });

  } catch (err) {
    console.error('Homework submissions error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
