// app/api/admin/departments/route.ts
// Real workflow: admin creates departments on day 1, assigns HOD, maps staff
// HOD is a staff member. No separate HOD login — they use teacher/admin role.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ departments: [] });

  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('*, hod:staff(id, name, email, role)')
    .eq('institution_id', school.institution_id)
    .order('code');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departments: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { code: string; name: string; hod_staff_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.code?.trim() || !body.name?.trim()) return NextResponse.json({ error: 'code and name required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin.from('departments').insert({
    institution_id: school.institution_id,
    school_id: schoolId,
    code: body.code.trim().toUpperCase(),
    name: body.name.trim(),
    hod_staff_id: body.hod_staff_id ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, department: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { id: string; name?: string; hod_staff_id?: string | null; is_active?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  const update: Record<string, unknown> = {};
  if (body.name) update.name = body.name.trim();
  if (body.hod_staff_id !== undefined) update.hod_staff_id = body.hod_staff_id;
  if (body.is_active !== undefined) update.is_active = body.is_active;

  const { data, error } = await supabaseAdmin.from('departments').update(update)
    .eq('id', body.id).eq('institution_id', school?.institution_id ?? '')
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, department: data });
}
