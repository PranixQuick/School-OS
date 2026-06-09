// app/api/admin/fee-categories/[id]/route.ts
// PR-103 — Fee Categories PATCH (update name / description / is_active)
// PATCH /api/admin/fee-categories/:id

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let auth;
  try { auth = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { id } = params;
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') {
    if (!body.name.trim()) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    updates.name = body.name.trim();
  }
  if (typeof body.description === 'string') updates.description = body.description.trim() || null;
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('fee_categories')
    .update(updates)
    .eq('id', id)
    .eq('school_id', auth.schoolId)
    .select('id, name, description, is_active, updated_at')
    .single();

  if (updateErr) {
    if (updateErr.code === '23505')
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    if (updateErr.code === 'PGRST116')
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    console.error('[fee-categories] update error:', updateErr.message);
    return NextResponse.json({ error: 'Failed to update category' }, { status: 500 });
  }

  return NextResponse.json({ category: updated });
}
