import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

// Principal assigns a substitute teacher to cover a class.
// Auth: session cookie via getSession from @/lib/auth.
//   - schoolId from session for cross-tenant scoping
//   - userId from session for the assigned_by audit trail
//
// Body: {
//   original_class_id: uuid,
//   original_period_id: uuid,
//   substitute_staff_id: uuid,
//   reason: string,
//   original_staff_id: uuid,
//   late_event_id?: uuid  // optional: if set, this assignment also resolves the late event
// }
//
// substitute_assignments.status enum (CHECK): pending | accepted | declined |
//   class_cancelled | completed. New assignments start as 'pending'.
//
// Transactional coupling (I2 — see Item 11 v7.1 spec):
//   IF late_event_id provided:
//     1. UPDATE teacher_late_events SET resolved_* WHERE id=X AND resolved_at IS NULL
//     2. If rowCount=0 -> 409 (already resolved by someone else), DO NOT INSERT
//     3. If rowCount=1 -> proceed to INSERT substitute_assignment
//     4. If INSERT fails -> attempt UNDO of resolution UPDATE (best-effort)
//   IF late_event_id NOT provided:
//     - skip step 1, INSERT directly
//
// Supabase JS doesn't expose multi-statement transactions. The "best-effort undo"
// pattern is acceptable for MVP. Inconsistencies log to console + Spawn 7
// inheritance for proper alerting plumbing.

interface AssignRequest {
  original_class_id?: string;
  original_period_id?: string;
  substitute_staff_id?: string;
  reason?: string;
  original_staff_id?: string;
  late_event_id?: string;
}

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const schoolId = session.schoolId;
    const principalUserId = session.userId;

    const body = await req.json() as AssignRequest;

    // Validate required fields.
    const required: (keyof AssignRequest)[] = [
      'original_class_id', 'original_period_id', 'substitute_staff_id',
      'reason', 'original_staff_id'
    ];
    for (const k of required) {
      if (!body[k]) return NextResponse.json({ error: `Missing required field: ${k}` }, { status: 400 });
    }
    // Validate UUIDs to fail fast on garbage input.
    const uuidFields = [
      body.original_class_id, body.original_period_id, body.substitute_staff_id,
      body.original_staff_id, body.late_event_id,
    ];
    for (const v of uuidFields) {
      if (v !== undefined && !UUID_RX.test(v)) {
        return NextResponse.json({ error: 'Invalid UUID format in request' }, { status: 400 });
      }
    }
    if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
      return NextResponse.json({ error: 'reason cannot be empty' }, { status: 400 });
    }
    if (body.reason.length > 500) {
      return NextResponse.json({ error: 'reason too long (max 500 chars)' }, { status: 400 });
    }
    if (body.substitute_staff_id === body.original_staff_id) {
      return NextResponse.json({ error: 'substitute_staff_id cannot equal original_staff_id' }, { status: 400 });
    }

    // Verify the substitute teacher exists, is active, role=teacher, belongs to this school.
    const { data: subTeacher, error: stErr } = await supabaseAdmin
      .from('staff')
      .select('id, school_id, role, is_active')
      .eq('id', body.substitute_staff_id)
      .single();

    if (stErr || !subTeacher) {
      return NextResponse.json({ error: 'Substitute teacher not found' }, { status: 404 });
    }
    if (subTeacher.school_id !== schoolId) {
      return NextResponse.json({ error: 'Substitute teacher belongs to a different school' }, { status: 403 });
    }
    if (subTeacher.role !== 'teacher') {
      return NextResponse.json({ error: 'Selected staff is not a teacher' }, { status: 400 });
    }
    if (!subTeacher.is_active) {
      return NextResponse.json({ error: 'Substitute teacher is not active' }, { status: 400 });
    }

    // I2 STEP 1: if late_event_id provided, attempt resolution UPDATE first.
    let resolvedLateEventNow = false;
    if (body.late_event_id) {
      const nowIso = new Date().toISOString();
      const { data: resolved, error: rErr } = await supabaseAdmin
        .from('teacher_late_events')
        .update({
          resolved_by: body.substitute_staff_id,
          resolved_reason: body.reason,
          resolved_at: nowIso,
        })
        .eq('id', body.late_event_id)
        .eq('school_id', schoolId)  // cross-tenant guard
        .is('resolved_at', null)
        .select('id, resolved_by, resolved_at')
        .maybeSingle();

      if (rErr) {
        console.error('Late event resolution UPDATE error:', rErr);
        return NextResponse.json({ error: 'Failed to resolve late event' }, { status: 500 });
      }

      if (!resolved) {
        // Already resolved by someone else (or doesn't exist for this school).
        const { data: existing } = await supabaseAdmin
          .from('teacher_late_events')
          .select('id, resolved_by, resolved_at, resolved_reason')
          .eq('id', body.late_event_id)
          .eq('school_id', schoolId)
          .maybeSingle();

        return NextResponse.json({
          error: 'Late event already resolved by another principal',
          existing_resolution: existing,
        }, { status: 409 });
      }

      resolvedLateEventNow = true;
    }

    // I2 STEP 2: INSERT the substitute assignment.
    // status: 'pending' (CHECK enum) — teacher must accept/decline to transition.
    // assigned_by: principalUserId from session (NOT NULL column on substitute_assignments).
    // late_event_id: optional FK to teacher_late_events, valid since FIX-1 migration.
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from('substitute_assignments')
      .insert({
        school_id: schoolId,
        original_staff_id: body.original_staff_id,
        substitute_staff_id: body.substitute_staff_id,
        original_class_id: body.original_class_id,
        original_period_id: body.original_period_id,
        reason: body.reason,
        assigned_by: principalUserId,
        late_event_id: body.late_event_id ?? null,
        status: 'pending',
      })
      .select('id, assigned_at, status')
      .single();

    if (aErr || !assignment) {
      console.error('Substitute assignment INSERT error:', aErr);

      // Best-effort undo of the resolution UPDATE if we did one.
      if (resolvedLateEventNow && body.late_event_id) {
        const { error: undoErr } = await supabaseAdmin
          .from('teacher_late_events')
          .update({ resolved_by: null, resolved_reason: null, resolved_at: null })
          .eq('id', body.late_event_id)
          .eq('school_id', schoolId);

        if (undoErr) {
          // Inconsistency: late event marked resolved but no assignment exists.
          console.error('UNDO FAILURE for late_event resolution:', undoErr,
            'late_event_id=', body.late_event_id);
          // Spawn 7 inheritance: plumb to founder_alerts via engine API.
        }
      }

      return NextResponse.json({ error: 'Failed to create substitute assignment' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      assignment_id: assignment.id,
      assigned_at: assignment.assigned_at,
      status: assignment.status,
      late_event_resolved: resolvedLateEventNow,
    });

  } catch (err) {
    console.error('Substitute assign error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
