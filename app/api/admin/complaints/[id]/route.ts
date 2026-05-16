import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';

// PR-2 Task A: Admin/principal updates a complaint.
// PATCH body accepts any subset of: { status, assigned_to (staff_id|null), resolution }
// Tenant boundary: complaint.school_id must match session schoolId.
// Status transition rules (enforced server-side):
//   open <-> under_review
//   open|under_review|escalated -> resolved (requires resolution text)
//   resolved -> closed
//   resolved|closed can return to under_review (re-opening)
//   escalated can be entered from open|under_review (manual flag) but not from resolved/closed
// (closed is terminal except via re-opening to under_review)

export const runtime = 'nodejs';

const VALID_STATUSES = new Set(['open', 'under_review', 'escalated', 'resolved', 'closed']);

const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  open: new Set(['under_review', 'escalated', 'resolved']),
  under_review: new Set(['open', 'escalated', 'resolved']),
  escalated: new Set(['under_review', 'resolved']),
  resolved: new Set(['under_review', 'closed']),
  closed: new Set(['under_review']),
};

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const { id: complaintId } = await context.params;
  if (!complaintId) {
    return NextResponse.json({ error: 'complaint id required' }, { status: 400 });
  }

  let body: { status?: string; assigned_to?: string | null; resolution?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Load current complaint to check tenant + current status
  const { data: current, error: loadErr } = await supabaseAdmin
    .from('parent_complaints')
    .select('id, school_id, status, resolution')
    .eq('id', complaintId)
    .maybeSingle();

  if (loadErr) {
    console.error('[admin-complaints PATCH] load error:', loadErr);
    return NextResponse.json({ error: 'Failed to load complaint' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
  }
  if (current.school_id !== ctx.schoolId) {
    return NextResponse.json({ error: 'Cross-tenant access denied' }, { status: 403 });
  }

  // Build update set
  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({
        error: 'Invalid status. Must be one of: ' + Array.from(VALID_STATUSES).join(', '),
      }, { status: 400 });
    }
    if (body.status !== current.status) {
      const allowed = ALLOWED_TRANSITIONS[current.status];
      if (!allowed || !allowed.has(body.status)) {
        return NextResponse.json({
          error: 'Cannot transition from ' + current.status + ' to ' + body.status,
        }, { status: 400 });
      }
      // resolved requires a resolution string
      if (body.status === 'resolved' && !body.resolution && !current.resolution) {
        return NextResponse.json({
          error: 'Resolution text required when marking as resolved',
        }, { status: 400 });
      }
      updates.status = body.status;
      if (body.status === 'resolved') updates.resolved_at = now;
      if (body.status === 'closed') updates.closed_at = now;
      // Re-opening clears resolved/closed timestamps
      if (body.status === 'under_review' || body.status === 'open') {
        updates.resolved_at = null;
        updates.closed_at = null;
      }
    }
  }

  if (body.assigned_to !== undefined) {
    if (body.assigned_to !== null && typeof body.assigned_to !== 'string') {
      return NextResponse.json({ error: 'assigned_to must be a staff id or null' }, { status: 400 });
    }
    // Validate staff belongs to this school (if not null)
    if (body.assigned_to) {
      const { data: staff } = await supabaseAdmin
        .from('staff')
        .select('id, school_id')
        .eq('id', body.assigned_to)
        .maybeSingle();
      if (!staff || staff.school_id !== ctx.schoolId) {
        return NextResponse.json({ error: 'Staff member not found in this school' }, { status: 400 });
      }
    }
    updates.assigned_to = body.assigned_to;
  }

  if (body.resolution !== undefined) {
    const r = (body.resolution ?? '').trim();
    if (r.length > 4000) {
      return NextResponse.json({ error: 'resolution max 4000 chars' }, { status: 400 });
    }
    updates.resolution = r.length > 0 ? r : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 });
  }

  const { data: updated, error: uErr } = await supabaseAdmin
    .from('parent_complaints')
    .update(updates)
    .eq('id', complaintId)
    .eq('school_id', ctx.schoolId)
    .select('id, status, assigned_to, resolution, resolved_at, closed_at, updated_at')
    .single();

  if (uErr || !updated) {
    console.error('[admin-complaints PATCH] update error:', uErr);
    return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
  }

  return NextResponse.json({ success: true, complaint: updated });
}
