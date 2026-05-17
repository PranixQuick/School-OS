// app/api/admin/departments/route.ts
// Departments: GET, POST (create), PATCH (edit/assign HOD), DELETE (deactivate)
// Real workflow: college registrar creates departments at start of year, assigns HODs
// HOD = Head of Department — assigned from staff table
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

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ departments: [] });

  const { data, error } = await supabaseAdmin
    .from('departments')
    .select('id, code, name, description, hod_staff_id, is_active, created_at, staff:hod_staff_id(name, email)')
    .eq('institution_id', school.institution_id)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ departments: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { code, name, description, hod_staff_id } = body;
  if (!code || !name) return NextResponse.json({ error: 'code and name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('departments')
    .insert({
      institution_id: school.institution_id,
      school_id: schoolId,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      hod_staff_id: hod_staff_id ? String(hod_staff_id) : null,
      is_active: true,
    })
    .select('id, code, name, is_active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, department: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, code, name, description, hod_staff_id, is_active } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Validate department belongs to this school's institution
  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const { data: dept } = await supabaseAdmin
    .from('departments').select('id').eq('id', String(id)).eq('institution_id', school?.institution_id ?? '').maybeSingle();
  if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (typeof code === 'string' && code.trim()) update.code = code.trim().toUpperCase();
  if (typeof name === 'string' && name.trim()) update.name = name.trim();
  if (typeof description === 'string') update.description = description.trim() || null;
  if (hod_staff_id !== undefined) update.hod_staff_id = hod_staff_id || null;
  if (typeof is_active === 'boolean') update.is_active = is_active;

  const { data, error } = await supabaseAdmin
    .from('departments').update(update).eq('id', String(id))
    .select('id, code, name, hod_staff_id, is_active').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If HOD changed, update staff department mapping
  if (hod_staff_id) {
    await supabaseAdmin.from('staff_departments')
      .upsert({ staff_id: String(hod_staff_id), department_id: String(id), is_primary: true },
        { onConflict: 'staff_id,department_id', ignoreDuplicates: true });
    // Also update staff.department_id directly
    await supabaseAdmin.from('staff')
      .update({ department_id: String(id) })
      .eq('id', String(hod_staff_id))
      .eq('school_id', schoolId);
  }

  return NextResponse.json({ success: true, department: data });
}
