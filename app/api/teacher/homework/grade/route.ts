import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher grades a single homework submission.
// Auth: phone+PIN per request.
//
// Body: {
//   phone, pin: required
//   submission_id: uuid required
//   marks_obtained?: number  (numeric, 0-1000 plausible range)
//   teacher_remarks?: string (max 2000 chars)
//   status?: 'graded' (default) | 'pending' | 'submitted' | 'late' | 'missed'
// }
//
// Authorization (cross-tenant guard): the submission's homework_id must belong
// to a homework row where assigned_by = teacher.id AND school_id = teacher.school_id.
// We enforce this via a sub-query lookup BEFORE updating.
//
// Status values are bound by DB CHECK constraint:
//   (pending, submitted, late, graded, missed).
// Other moderation-style vocabularies are not valid here per Item 12 fingerprint resolution.

interface GradeRequest {
  phone?: string;
  pin?: string;
  submission_id?: string;
  marks_obtained?: number | null;
  teacher_remarks?: string;
  status?: string;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ['pending', 'submitted', 'late', 'graded', 'missed'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GradeRequest;

    if (!body.phone || !body.pin) {
      return NextResponse.json({ error: 'phone and pin required' }, { status: 400 });
    }
    if (!body.submission_id || !UUID_RX.test(body.submission_id)) {
      return NextResponse.json({ error: 'Valid submission_id required' }, { status: 400 });
    }
    if (body.marks_obtained !== undefined && body.marks_obtained !== null) {
      if (typeof body.marks_obtained !== 'number' || isNaN(body.marks_obtained)) {
        return NextResponse.json({ error: 'marks_obtained must be a number' }, { status: 400 });
      }
      if (body.marks_obtained < 0 || body.marks_obtained > 1000) {
        return NextResponse.json({ error: 'marks_obtained out of range (0-1000)' }, { status: 400 });
      }
    }
    if (body.teacher_remarks !== undefined) {
      if (typeof body.teacher_remarks !== 'string') {
        return NextResponse.json({ error: 'teacher_remarks must be a string' }, { status: 400 });
      }
      if (body.teacher_remarks.length > 2000) {
        return NextResponse.json({ error: 'teacher_remarks too long (max 2000 chars)' }, { status: 400 });
      }
    }

    // Status validation against DB CHECK enum.
    let resolvedStatus: ValidStatus = 'graded';  // default
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !(VALID_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json({
          error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        }, { status: 400 });
      }
      resolvedStatus = body.status as ValidStatus;
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

    // Authorization: load the submission, then verify its homework belongs to this teacher.
    const { data: submission, error: subErr } = await supabaseAdmin
      .from('homework_submissions')
      .select('id, homework_id, student_id, status')
      .eq('id', body.submission_id)
      .maybeSingle();

    if (subErr) {
      console.error('Submission lookup error:', subErr);
      return NextResponse.json({ error: 'Failed to load submission' }, { status: 500 });
    }
    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Cross-tenant + ownership guard via parent homework row.
    const { data: parentHw, error: phErr } = await supabaseAdmin
      .from('homework')
      .select('id, school_id, assigned_by')
      .eq('id', submission.homework_id)
      .eq('school_id', teacher.school_id)
      .eq('assigned_by', teacher.id)
      .maybeSingle();

    if (phErr) {
      console.error('Parent homework lookup error:', phErr);
      return NextResponse.json({ error: 'Failed to verify homework ownership' }, { status: 500 });
    }
    if (!parentHw) {
      return NextResponse.json({ error: 'You did not assign this homework' }, { status: 403 });
    }

    // Build the UPDATE patch. Only set fields that were provided.
    const patch: Record<string, unknown> = { status: resolvedStatus };
    if (body.marks_obtained !== undefined) patch.marks_obtained = body.marks_obtained;
    if (body.teacher_remarks !== undefined) patch.teacher_remarks = body.teacher_remarks?.trim() ?? null;
    // If status is being moved to 'graded', stamp submitted_at if not already set.
    // (For Item 12 we don't set submitted_at here — the 'submitted' transition is Item 13 territory.)

    const { data: updated, error: uErr } = await supabaseAdmin
      .from('homework_submissions')
      .update(patch)
      .eq('id', submission.id)
      .select('id, status, marks_obtained, teacher_remarks, submitted_at')
      .single();

    if (uErr || !updated) {
      console.error('Submission UPDATE error:', uErr);
      return NextResponse.json({ error: 'Failed to update submission' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      submission: updated,
    });

  } catch (err) {
    console.error('Homework grade error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
