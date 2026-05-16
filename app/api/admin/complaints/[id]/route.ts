import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

// PR-2 Task A: Admin complaint update endpoint.
// PATCH /api/admin/complaints/[id]
//   { status?, assigned_to?, resolution? }
//
// Status transition rules (enforced server-side):
//   open          -> under_review | escalated | resolved | closed
//   under_review  -> escalated | resolved | closed
//   escalated     -> under_review | resolved | closed
//   resolved      -> closed   (no regression — cannot reopen via PATCH)
//   closed        -> (no transitions)
//
// Marking status=resolved requires resolution text and stamps resolved_at.
// Marking status=closed stamps closed_at.

export const runtime = 'nodejs';

const ALLOWED_TRANSITIONS: Record<string, Set<string>> = {
  open:         new Set(['under_review','escalated','resolved','closed']),
  under_review: new Set(['escalated','resolved','closed']),
  escalated:    new Set(['under_review','resolved','closed']),
  resolved:     new Set(['closed']),
  closed:       new Set([]),
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
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  let body: PatchBody;
  try { body = await req.json() as PatchBody; }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Load current row to validate transition + tenant boundary
  const { data: current, error: loadErr } = await supabaseAdmin
    .from('parent_complaints')
    .select('id, school_id, status')
    .eq('id', id)
    .maybeSingle();

  if (loadErr) {
    console.error('Admin complaint load error:', loadErr);
    return NextResponse.json({ error: 'Failed to load complaint' }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
  if (current.school_id !== ctx.schoolId) {
    // 404 (not 403) to avoid cross-tenant existence leak
    return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();

  // ── status transition ────────────────────────────────────────────────────
  if (body.status !== undefined) {
    const transitions = ALLOWED_TRANSITIONS[current.status];
    if (!transitions) {
      return NextResponse.json({ error: `Unknown current status: ${current.status}` }, { status: 500 });
    }
    if (body.status !== current.status && !transitions.has(body.status)) {
      return NextResponse.json({
        error: `Cannot transition from ${current.status} to ${body.status}`,
      }, { status: 400 });
    }
    updates.status = body.status;

    if (body.status === 'resolved') {
      const resolutionText = (body.resolution ?? '').trim();
      if (!resolutionText) {
        return NextResponse.json({ error: 'resolution text is required when marking resolved' }, { status: 400 });
      }
      if (resolutionText.length > 4000) {
        return NextResponse.json({ error: 'resolution must be 4000 characters or fewer' }, { status: 400 });
      }
      updates.resolution = resolutionText;
      updates.resolved_at = now;
    }
    if (body.status === 'closed') {
      updates.closed_at = now;
    }
  }

  // ── assignment ───────────────────────────────────────────────────────────
  if (body.assigned_to !== undefined) {
    if (body.assigned_to === null || body.assigned_to === '') {
      updates.assigned_to = null;
    } else {
      // Validate the staff member belongs to this school
      const { data: staff } = await supabaseAdmin
        .from('staff')
        .select('id, school_id')
        .eq('id', body.assigned_to)
        .maybeSingle();
      if (!staff || staff.school_id !== ctx.schoolId) {
        return NextResponse.json({ error: 'assigned_to staff member not found in this school' }, { status: 400 });
      }
      updates.assigned_to = body.assigned_to;
    }
  }

  // ── resolution update without status change (allowed for any non-closed state) ──
  if (body.resolution !== undefined && updates.resolution === undefined && body.status === undefined) {
    const r = (body.resolution ?? '').trim();
    if (r.length > 4000) {
      return NextResponse.json({ error: 'resolution must be 4000 characters or fewer' }, { status: 400 });
    }
    updates.resolution = r === '' ? null : r;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no updates supplied' }, { status: 400 });
  }

  const { data: updated, error: updErr } = await supabaseAdmin
    .from('parent_complaints')
    .update(updates)
    .eq('id', id)
    .eq('school_id', ctx.schoolId)  // double-guard
    .select('id, complaint_type, subject, status, resolution, assigned_to, updated_at, resolved_at, closed_at')
    .single();

  if (updErr || !updated) {
    console.error('Admin complaint update error:', updErr);
    return NextResponse.json({ error: updErr?.message ?? 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true, complaint: updated });
}
