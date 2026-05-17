// app/api/admin/parents/route.ts
// Parent management: GET list, PATCH edit (phone/email/name), DELETE deactivate
// Resend credentials via POST /api/admin/parents/resend-credentials
// Real workflow: office staff updates parent phone number, resends PIN via WhatsApp

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const studentId = req.nextUrl.searchParams.get('student_id');
  const search = req.nextUrl.searchParams.get('q');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '200', 10) || 200, 500);

  let q = supabaseAdmin
    .from('parents')
    .select('id, name, phone, email, language_pref, is_active, student_id, access_pin_hashed, credential_sent_at, credential_sent_via, created_at')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })
    .limit(limit);

  if (studentId) q = q.eq('student_id', studentId);
  if (search) q = q.ilike('name', `%${search}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ parents: data ?? [], count: (data ?? []).length });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, name, phone, email, language_pref, is_active } = body as Record<string, unknown>;
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof name === 'string') update.name = name.trim() || null;
  if (typeof phone === 'string') update.phone = phone.trim() || null;
  if (typeof email === 'string') update.email = email.trim().toLowerCase() || null;
  if (typeof language_pref === 'string') update.language_pref = language_pref;
  if (typeof is_active === 'boolean') update.is_active = is_active;

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('parents')
    .update(update)
    .eq('id', id)
    .eq('school_id', schoolId)
    .select('id, name, phone, email, is_active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, parent: data });
}

export async function DELETE(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Soft delete — deactivate parent access, do not remove record
  const { error } = await supabaseAdmin
    .from('parents')
    .update({ is_active: false })
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: 'Parent account deactivated' });
}
