// app/api/principal/report-narratives/[id]/approve/route.ts
// Batch 13 — Principal approve/reject narrative.
// report_narratives.status constraint: draft/approved/rejected
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requirePrincipalSession, PrincipalAuthError } from '@/lib/principal-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requirePrincipalSession(req); }
  catch (e) { if (e instanceof PrincipalAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId, staffId } = ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, notes } = body as { action?: string; notes?: string };
  if (!action || !['approve','reject'].includes(action))
    return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });

  // Verify narrative belongs to this school
  const { data: existing } = await supabaseAdmin
    .from('report_narratives').select('id, status').eq('id', id).eq('school_id', schoolId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Narrative not found' }, { status: 404 });

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const patch: Record<string, unknown> = {
    status: newStatus,
    principal_notes: notes ?? null,
  };
  if (action === 'approve') {
    patch.approved_by = staffId ?? null;
    patch.approved_at = new Date().toISOString();
  } else {
    patch.approved_by = null;
    patch.approved_at = null;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('report_narratives').update(patch).eq('id', id).eq('school_id', schoolId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ narrative: updated });
}
