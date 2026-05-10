import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Parent fetches their student's homework + submission status.
// Auth: phone+PIN per request (Item 13 pattern).
//
// Body: {
//   phone, pin: required
//   status_filter?: 'pending' | 'submitted' | 'late' | 'graded' | 'missed' | 'all' (default 'all')
//   limit?: number (default 50, max 100)
// }
//
// Approach: parent's student_id is found via re-auth, then we query homework_submissions
// joined with parent homework rows. submission status is the parent-facing view (the
// homework was assigned, did the student submit/get graded?).
//
// status_filter='all' returns all rows including 'pending'. Otherwise filters to that
// specific status value.
//
// Status enum (DB CHECK on homework_submissions): pending, submitted, late, graded, missed.

interface HomeworkRequest {
  phone?: string;
  pin?: string;
  status_filter?: string;
  limit?: number;
}

const VALID_FILTERS = ['pending', 'submitted', 'late', 'graded', 'missed', 'all'] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as HomeworkRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (body.status_filter !== undefined && !(VALID_FILTERS as readonly string[]).includes(body.status_filter)) {
      return NextResponse.json({
        error: `Invalid status_filter. Must be one of: ${VALID_FILTERS.join(', ')}`,
      }, { status: 400 });
    }
    const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);

    // Re-auth parent (multi-tenant guard via length check).
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

    // Fetch homework_submissions for this student.
    let q = supabaseAdmin
      .from('homework_submissions')
      .select('id, homework_id, status, submitted_at, marks_obtained, teacher_remarks, attachments')
      .eq('student_id', parent.student_id);

    if (body.status_filter && body.status_filter !== 'all') {
      q = q.eq('status', body.status_filter);
    }

    const { data: submissions, error: sErr } = await q.limit(limit);

    if (sErr) {
      console.error('Submissions query error:', sErr);
      return NextResponse.json({ error: 'Failed to load homework' }, { status: 500 });
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        homework: [],
        summary: { pending: 0, submitted: 0, late: 0, graded: 0, missed: 0 },
      });
    }

    // Hydrate parent homework rows + subjects.
    const homeworkIds = submissions.map(s => s.homework_id);
    const { data: homeworkRows, error: hErr } = await supabaseAdmin
      .from('homework')
      .select('id, class_id, subject_id, title, description, due_date, attachments, created_at')
      .in('id', homeworkIds)
      .eq('school_id', parent.school_id);  // cross-tenant guard

    if (hErr) {
      console.error('Homework hydrate error:', hErr);
      return NextResponse.json({ error: 'Failed to load homework details' }, { status: 500 });
    }

    const homeworkMap = new Map((homeworkRows ?? []).map(h => [h.id, h]));
    const subjectIds = Array.from(new Set((homeworkRows ?? []).map(h => h.subject_id).filter(Boolean)));

    let subjectMap = new Map<string, { id: string; name: string; code: string }>();
    if (subjectIds.length > 0) {
      const { data: subjects, error: subjErr } = await supabaseAdmin
        .from('subjects')
        .select('id, name, code')
        .in('id', subjectIds);
      if (subjErr) console.error('Subjects hydrate error:', subjErr);
      subjectMap = new Map((subjects ?? []).map(s => [s.id, s]));
    }

    // Sort: pending/late/missed first (action needed), then submitted, then graded.
    // Within each group, sort by due_date DESC (most recent first).
    const STATUS_RANK: Record<string, number> = {
      pending: 0,
      late: 1,
      missed: 2,
      submitted: 3,
      graded: 4,
    };

    const enriched = submissions
      .map(s => {
        const hw = homeworkMap.get(s.homework_id);
        return {
          submission_id: s.id,
          status: s.status,
          submitted_at: s.submitted_at,
          marks_obtained: s.marks_obtained,
          teacher_remarks: s.teacher_remarks,
          submission_attachments: s.attachments ?? [],
          homework: hw ? {
            id: hw.id,
            title: hw.title,
            description: hw.description,
            due_date: hw.due_date,
            attachments: hw.attachments ?? [],
            created_at: hw.created_at,
            subject: hw.subject_id ? subjectMap.get(hw.subject_id) ?? null : null,
          } : null,
        };
      })
      .filter(r => r.homework !== null)  // drop orphaned submissions (homework deleted)
      .sort((a, b) => {
        const rankDiff = (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        const dateA = a.homework?.due_date ?? '';
        const dateB = b.homework?.due_date ?? '';
        return dateB.localeCompare(dateA);  // newest first
      });

    // Summary across all submissions for this student (not just the filtered set).
    const summary = {
      pending: submissions.filter(s => s.status === 'pending').length,
      submitted: submissions.filter(s => s.status === 'submitted').length,
      late: submissions.filter(s => s.status === 'late').length,
      graded: submissions.filter(s => s.status === 'graded').length,
      missed: submissions.filter(s => s.status === 'missed').length,
    };

    return NextResponse.json({
      success: true,
      total: enriched.length,
      summary,
      homework: enriched,
    });

  } catch (err) {
    console.error('Parent homework error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
