// app/api/admin/fee-categories/route.ts
// PR-103 — Fee Categories API
// GET  /api/admin/fee-categories  — list categories for school
// POST /api/admin/fee-categories  — create category

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export async function GET(req: NextRequest) {
  let auth;
  try { auth = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const { searchParams } = new URL(req.url);
  const showInactive = searchParams.get('show_inactive') === 'true';

  let query = supabaseAdmin
    .from('fee_categories')
    .select('id, name, description, is_active, created_at, updated_at')
    .eq('school_id', auth.schoolId)
    .order('name', { ascending: true });

  if (!showInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to load categories' }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(req: NextRequest) {
  let auth;
  try { auth = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const { name, description } = body as { name?: string; description?: string };
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const { data: created, error: createErr } = await supabaseAdmin
    .from('fee_categories')
    .insert({
      school_id: auth.schoolId,
      name: name.trim(),
      description: description?.trim() ?? null,
      is_active: true,
    })
    .select('id, name, description, is_active, created_at, updated_at')
    .single();

  if (createErr) {
    if (createErr.code === '23505')
      return NextResponse.json({ error: 'A category with this name already exists' }, { status: 409 });
    console.error('[fee-categories] create error:', createErr.message);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }

  return NextResponse.json({ category: created }, { status: 201 });
}
