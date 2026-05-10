import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';

// Teacher creates or updates a lesson plan.
// Auth: phone+PIN per request.
//
// Body: {
//   phone, pin: required
//   class_id: uuid required
//   subject_id?: uuid
//   topic_id?: uuid (opaque pass-through)
//   planned_date: YYYY-MM-DD required
//   completion_status?: 'planned' (default) | 'in_progress' | 'completed' | 'skipped'
//   notes?: string (max 4000 chars)
//   lesson_plan_id?: uuid  // if provided -> UPDATE (ownership-guarded), else INSERT
// }
//
// completion_status enum (DB CHECK): planned | in_progress | completed | skipped.
//
// Authorization (INSERT): teacher must be assigned to this class via timetable.
// Authorization (UPDATE): the lesson_plan row must already have staff_id = teacher.id
//   AND school_id = teacher.school_id.
//
// On status transition to 'completed', completed_at is set to NOW().
// On any other status, completed_at is set to NULL.

interface UpsertRequest {
  phone?: string;
  pin?: string;
  class_id?: string;
  subject_id?: string;
  topic_id?: string;
  planned_date?: string;
  completion_status?: string;
  notes?: string;
  lesson_plan_id?: string;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ['planned', 'in_progress', 'completed', 'skipped'] as const;
type ValidStatus = typeof VALID_STATUSES[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as UpsertRequest;

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
    if (body.topic_id && !UUID_RX.test(body.topic_id)) {
      return NextResponse.json({ error: 'Invalid topic_id format' }, { status: 400 });
    }
    if (body.lesson_plan_id && !UUID_RX.test(body.lesson_plan_id)) {
      return NextResponse.json({ error: 'Invalid lesson_plan_id format' }, { status: 400 });
    }
    if (!body.planned_date || !DATE_RX.test(body.planned_date)) {
      return NextResponse.json({ error: 'Valid planned_date required (YYYY-MM-DD)' }, { status: 400 });
    }
    if (body.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 4000)) {
      return NextResponse.json({ error: 'notes must be a string <=4000 chars' }, { status: 400 });
    }

    // Status validation.
    let resolvedStatus: ValidStatus = 'planned';
    if (body.completion_status !== undefined) {
      if (typeof body.completion_status !== 'string' || !(VALID_STATUSES as readonly string[]).includes(body.completion_status)) {
        return NextResponse.json({
          error: `Invalid completion_status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        }, { status: 400 });
      }
      resolvedStatus = body.completion_status as ValidStatus;
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
      return NextResponse.json({ error: 'Only teachers can manage lesson plans' }, { status: 403 });
    }

    // Authorization: timetable assignment for this class.
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

    // Compute completed_at side effect.
    const completedAt = resolvedStatus === 'completed' ? new Date().toISOString() : null;
    const trimmedNotes = body.notes?.trim() ?? null;

    if (body.lesson_plan_id) {
      // UPDATE path: ownership-guarded by staff_id = teacher.id.
      const patch: Record<string, unknown> = {
        class_id: body.class_id,
        subject_id: body.subject_id ?? null,
        topic_id: body.topic_id ?? null,
        planned_date: body.planned_date,
        completion_status: resolvedStatus,
        completed_at: completedAt,
        notes: trimmedNotes,
      };

      const { data: updated, error: uErr } = await supabaseAdmin
        .from('lesson_plans')
        .update(patch)
        .eq('id', body.lesson_plan_id)
        .eq('staff_id', teacher.id)
        .eq('school_id', teacher.school_id)
        .select('id, planned_date, completion_status, completed_at, notes')
        .maybeSingle();

      if (uErr) {
        console.error('Lesson plan UPDATE error:', uErr);
        return NextResponse.json({ error: 'Failed to update lesson plan' }, { status: 500 });
      }
      if (!updated) {
        return NextResponse.json({ error: 'Lesson plan not found or not owned by you' }, { status: 404 });
      }

      return NextResponse.json({ success: true, action: 'updated', plan: updated });
    } else {
      // INSERT path.
      const { data: inserted, error: iErr } = await supabaseAdmin
        .from('lesson_plans')
        .insert({
          school_id: teacher.school_id,
          class_id: body.class_id,
          subject_id: body.subject_id ?? null,
          staff_id: teacher.id,
          topic_id: body.topic_id ?? null,
          planned_date: body.planned_date,
          completion_status: resolvedStatus,
          completed_at: completedAt,
          notes: trimmedNotes,
        })
        .select('id, planned_date, completion_status, completed_at, notes')
        .single();

      if (iErr || !inserted) {
        console.error('Lesson plan INSERT error:', iErr);
        return NextResponse.json({ error: 'Failed to create lesson plan' }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'created', plan: inserted });
    }

  } catch (err) {
    console.error('Lesson plan upsert error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
