// app/api/admin/scholarships/[id]/route.ts
// Batch 4A — Update scholarship status.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { status, approved_at, notes } = body as { status?: string; approved_at?: string; notes?: string };

  const patch: Record<string, unknown> = {};
  if (status) patch.status = status;
  if (approved_at !== undefined) patch.approved_at = approved_at;
  if (notes !== undefined) patch.notes = notes;
  if (status === 'approved' && !approved_at) patch.approved_at = new Date().toISOString();

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data: updated, error } = await supabaseAdmin
    .from('scholarships').update(patch)
    .eq('id', id).eq('school_id', schoolId).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: 'Scholarship not found' }, { status: 404 });

  return NextResponse.json({ scholarship: updated });
}
