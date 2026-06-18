// app/api/admin/subjects/route.ts
// Admin subjects management (ISS-3 / #3).
// GET: list subjects for the admin's school (used by the timetable + subjects UI).
// POST/PATCH/DELETE: manage subjects incl. subject_kind. Mutations restricted to
// academic-management roles; all operations scoped to the caller's school_id.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError, type AdminContext } from '@/lib/admin-auth';
import { getInstitutionForSchool } from '@/lib/tenant-lookup';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const SUBJECT_KINDS = ['academic', 'lab', 'sports', 'activity', 'seminar', 'library', 'break', 'remedial'];
const WRITE_ROLES = new Set(['owner', 'principal', 'admin', 'admin_staff']);

function requireWrite(ctx: AdminContext) {
  if (!WRITE_ROLES.has(ctx.userRole)) {
    throw new AdminAuthError('Your role cannot manage subjects', 403);
  }
}

const SELECT_COLS = 'id, code, name, subject_kind, board_alignment';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .select(SELECT_COLS)
    .eq('school_id', ctx.schoolId)
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subjects: data ?? [], count: (data ?? []).length });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); requireWrite(ctx); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  let body: { code?: string; name?: string; subject_kind?: string; board_alignment?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const code = (body.code ?? '').trim();
  const name = (body.name ?? '').trim();
  const subject_kind = (body.subject_kind ?? 'academic').trim();
  const board_alignment = body.board_alignment?.trim() || null;

  if (!code || !name) return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
  if (!SUBJECT_KINDS.includes(subject_kind)) return NextResponse.json({ error: `invalid subject_kind (allowed: ${SUBJECT_KINDS.join(', ')})` }, { status: 400 });

  const { institution_id } = await getInstitutionForSchool(ctx.schoolId);

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .insert({ school_id: ctx.schoolId, institution_id, code, name, subject_kind, board_alignment })
    .select(SELECT_COLS)
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: `A subject with code "${code}" already exists` }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ subject: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); requireWrite(ctx); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  let body: { id?: string; code?: string; name?: string; subject_kind?: string; board_alignment?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const id = (body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.code !== undefined) { const c = body.code.trim(); if (!c) return NextResponse.json({ error: 'code cannot be empty' }, { status: 400 }); patch.code = c; }
  if (body.name !== undefined) { const n = body.name.trim(); if (!n) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 }); patch.name = n; }
  if (body.subject_kind !== undefined) { if (!SUBJECT_KINDS.includes(body.subject_kind)) return NextResponse.json({ error: `invalid subject_kind (allowed: ${SUBJECT_KINDS.join(', ')})` }, { status: 400 }); patch.subject_kind = body.subject_kind; }
  if (body.board_alignment !== undefined) patch.board_alignment = body.board_alignment?.trim() || null;

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'no fields to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .update(patch)
    .eq('id', id)
    .eq('school_id', ctx.schoolId)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '23505') return NextResponse.json({ error: 'Another subject already uses that code' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'subject not found' }, { status: 404 });
  return NextResponse.json({ subject: data });
}

export async function DELETE(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); requireWrite(ctx); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  let subjectId = (req.nextUrl.searchParams.get('id') ?? '').trim();
  if (!subjectId) { try { const b = await req.json() as { id?: string }; subjectId = (b?.id ?? '').trim(); } catch { /* no body */ } }
  if (!subjectId) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('subjects')
    .delete()
    .eq('id', subjectId)
    .eq('school_id', ctx.schoolId)
    .select('id');

  if (error) {
    if ((error as { code?: string }).code === '23503') return NextResponse.json({ error: 'Cannot delete: this subject is still used by a timetable, curriculum, or class assignment. Remove those references first.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'subject not found' }, { status: 404 });
  return NextResponse.json({ deleted: subjectId });
}
