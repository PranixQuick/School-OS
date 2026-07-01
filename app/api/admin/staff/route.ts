// app/api/admin/staff/route.ts
// Staff management: GET (list), POST (create), PATCH (edit), DELETE (deactivate)
// Audit fix B4: POST/PATCH/DELETE added — previously GET-only

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// ── GET — list staff ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === '1';
  const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('limit') ?? '500', 10) || 500, 1), 1000);

  let q = supabaseAdmin
    .from('staff')
    .select('id, name, role, subject, phone, email, is_active, institution_id, created_at, designation, joined_at, relieved_at, notes, employee_code, document_url')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })
    .limit(limit);

  if (!includeInactive) q = q.eq('is_active', true);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ staff: data ?? [], count: (data ?? []).length });
}

// ── POST — create staff member ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { name, role, email, phone, subject, designation, notes, joined_at, relieved_at, employee_code, document_url } = body as Record<string, string | undefined>;
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const VALID_ROLES = new Set(['teacher', 'principal', 'admin', 'counsellor', 'admin_staff', 'accountant', 'librarian']);
  const staffRole = VALID_ROLES.has(role ?? '') ? role! : 'teacher';

  // Resolve institution_id
  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const institutionId = school?.institution_id ?? null;

  const { data: staffRow, error: sErr } = await supabaseAdmin
    .from('staff')
    .insert({
      school_id: schoolId,
      institution_id: institutionId,
      name: name.trim(),
      role: staffRole,
      email: email?.trim().toLowerCase() ?? null,
      phone: phone?.trim() ?? null,
      subject: subject?.trim() ?? null,
      designation: designation?.trim() ?? null,
      notes: notes?.trim() ?? null,
      joined_at: joined_at || null,
      relieved_at: relieved_at || null,
      employee_code: employee_code?.trim() ?? null,
      document_url: document_url?.trim() ?? null,
      is_active: true,
    })
    .select('id, name, role, email, phone, subject, designation, notes, joined_at, relieved_at, employee_code, document_url, is_active')
    .single();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  // Create school_users login if email provided
  if (email?.trim()) {
    const roleV2 = staffRole === 'admin' ? 'admin_staff' : staffRole;
    await supabaseAdmin.from('school_users').upsert({
      school_id: schoolId,
      institution_id: institutionId,
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role: staffRole === 'teacher' ? 'teacher' : 'admin',
      role_v2: roleV2,
      staff_id: staffRow.id,
      is_active: true,
    }, { onConflict: 'school_id,email', ignoreDuplicates: true });
  }

  const initialPassword = `edprosys${schoolId.slice(0, 4)}`;
  return NextResponse.json({
    success: true,
    staff: staffRow,
    ...(email?.trim() ? {
      login: { email: email.trim().toLowerCase(), password: initialPassword },
    } : {}),
  });
}

// ── PATCH — update staff member ────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, name, role, email, phone, subject, is_active, designation, notes, joined_at, relieved_at, employee_code, document_url } = body as Record<string, unknown>;
  if (!id || typeof id !== 'string') return NextResponse.json({ error: 'id required' }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) update.name = name.trim();
  if (typeof role === 'string') update.role = role;
  if (typeof email === 'string') update.email = email.trim().toLowerCase() || null;
  if (typeof phone === 'string') update.phone = phone.trim() || null;
  if (typeof subject === 'string') update.subject = subject.trim() || null;
  if (typeof is_active === 'boolean') update.is_active = is_active;
  if (typeof designation === 'string') update.designation = designation.trim() || null;
  if (typeof notes === 'string') update.notes = notes.trim() || null;
  if (typeof joined_at === 'string') update.joined_at = joined_at || null;
  if (typeof relieved_at === 'string') update.relieved_at = relieved_at || null;
  if (typeof employee_code === 'string') update.employee_code = employee_code.trim() || null;
  if (typeof document_url === 'string') update.document_url = document_url.trim() || null;

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('staff')
    .update(update)
    .eq('id', id)
    .eq('school_id', schoolId)  // scoped to school — cannot edit other school's staff
    .select('id, name, role, email, phone, subject, designation, notes, joined_at, relieved_at, employee_code, document_url, is_active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep school_users in sync if name/is_active changed
  if (update.name || update.is_active !== undefined) {
    const userUpdate: Record<string, unknown> = {};
    if (update.name) userUpdate.name = update.name;
    if (update.is_active !== undefined) userUpdate.is_active = update.is_active;
    await supabaseAdmin.from('school_users')
      .update(userUpdate)
      .eq('staff_id', id)
      .eq('school_id', schoolId);
  }

  return NextResponse.json({ success: true, staff: data });
}

// ── DELETE — deactivate staff member (soft delete) ─────────────────────────
export async function DELETE(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required' }, { status: 400 });

  // Soft delete — deactivate, do not hard delete (preserves audit trail)
  const { error } = await supabaseAdmin
    .from('staff')
    .update({ is_active: false })
    .eq('id', id)
    .eq('school_id', schoolId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Deactivate school_users account
  await supabaseAdmin.from('school_users')
    .update({ is_active: false })
    .eq('staff_id', id)
    .eq('school_id', schoolId);

  return NextResponse.json({ success: true, message: 'Staff member deactivated' });
}
