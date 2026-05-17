// app/api/admin/parents/route.ts
// Parent management: GET (list), PATCH (edit), DELETE (unlink/deactivate)
// Real workflow: parent phone change is the #1 request to school office
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const studentId = req.nextUrl.searchParams.get('student_id');
  const search    = req.nextUrl.searchParams.get('q');
  const limit     = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '100'), 500);

  let q = supabaseAdmin
    .from('parents')
    .select('id, name, phone, email, language_pref, student_id, last_access, whatsapp_opted_out, access_pin, created_at')
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
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, name, phone, email, language_pref } = body as Record<string, string | undefined>;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (name?.trim())  update.name  = name.trim();
  if (phone?.trim()) update.phone = phone.trim();
  if (email?.trim()) update.email = email.trim().toLowerCase();
  if (language_pref) update.language_pref = language_pref;

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('parents').update(update)
    .eq('id', id).eq('school_id', schoolId)
    .select('id, name, phone, email, language_pref').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If phone changed, clear access_pin so a fresh one can be issued
  if (update.phone) {
    await supabaseAdmin.from('parents').update({ access_pin: null }).eq('id', id);
  }

  return NextResponse.json({ success: true, parent: data });
}

export async function DELETE(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

  // Nullify phone and PIN — parent can no longer log in but record kept for history
  const { error } = await supabaseAdmin
    .from('parents')
    .update({ phone: null, access_pin: null, access_pin_hashed: null })
    .eq('id', id).eq('school_id', schoolId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: 'Parent access revoked. Record retained for audit.' });
}
