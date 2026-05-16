import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task A: Admin complaint PATCH.
// Updates: status, assigned_to (staff_id), resolution
// Auto-stamps resolved_at / closed_at when transitioning to those states.
//
// Tenant guard: complaint must belong to caller's school.

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set([
  'open', 'under_review', 'escalated', 'resolved', 'closed',
]);

// Allowed forward transitions. escalated can come from any open state; closed
// is terminal. We deliberately don't allow resolved/closed → open to avoid
// status regression.
const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  open:          new Set(['under_review', 'escalated', 'resolved', 'closed']),
  under_review:  new Set(['escalated', 'resolved', 'closed']),
  escalated:     new Set(['under_review', 'resolved', 'closed']),
  resolved:      new Set(['closed']),
  closed:        new Set([]),
};

interface PatchBody {
  status?: string;
  assigned_to?: string | null;
  resolution?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
  const { schoolId } = ctx;
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'complaint id required' }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Fetch existing complaint to check tenant + current status for transition rules
  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('parent_complaints')
    .select('id, school_id, status, resolved_at, closed_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    console.error('Complaint fetch error:', fetchErr);
    return NextResponse.json({ error: 'Failed to load complaint' }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
  }
  if (existing.school_id !== schoolId) {
    return NextResponse.json({ error: 'Complaint does not belong to your school' }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();

  // Status transition
  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({
        error: 'status must be one of: open, under_review, escalated, resolved, closed',
      }, { status: 400 });
    }
    if (body.status !== existing.status) {
      const allowedNext = ALLOWED_TRANSITIONS[existing.status];
      if (!allowedNext || !allowedNext.has(body.status)) {
        return NextResponse.json({
          error: `Cannot transition from ${existing.status} to ${body.status}`,
        }, { status: 400 });
      }
      updates.status = body.status;
      if (body.status === 'resolved' && !existing.resolved_at) {
        updates.resolved_at = now;
      }
      if (body.status === 'closed') {
        updates.closed_at = now;
        // If closing without an explicit resolved_at, stamp it now too
        if (!existing.resolved_at) updates.resolved_at = now;
      }
    }
  }

  // Staff assignment
  if (body.assigned_to !== undefined) {
    if (body.assigned_to === null || body.assigned_to === '') {
      updates.assigned_to = null;
    } else {
      // Verify the staff belongs to the same school
      const { data: staff } = await supabaseAdmin
        .from('staff')
        .select('id, school_id')
        .eq('id', body.assigned_to)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (!staff) {
        return NextResponse.json({ error: 'Staff not found in this school' }, { status: 400 });
      }
      updates.assigned_to = staff.id;
    }
  }

  // Resolution text
  if (body.resolution !== undefined) {
    if (typeof body.resolution !== 'string') {
      return NextResponse.json({ error: 'resolution must be a string' }, { status: 400 });
    }
    if (body.resolution.length > 4000) {
      return NextResponse.json({ error: 'resolution must be 4000 chars or less' }, { status: 400 });
    }
    updates.resolution = body.resolution.trim() || null;
  }

  // If status transitions to resolved/closed, resolution is recommended but not required.
  // We allow resolution to be set without status change too (e.g., draft notes).

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('parent_complaints')
    .update(updates)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select('id, complaint_type, subject, description, status, assigned_to, resolution, resolved_at, closed_at, created_at, updated_at, parent_phone, student_id')
    .single();

  if (updateErr || !updated) {
    console.error('Complaint update error:', updateErr);
    return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
  }

  return NextResponse.json({ success: true, complaint: updated });
}
