// app/api/admin/staff/link-login/route.ts
// Links an EXISTING school_users login to a staff record (creating the staff row
// if one does not yet exist for that email), setting staff_id + role_v2.
//
// Why this exists: POST /api/admin/staff upserts school_users with
// ignoreDuplicates:true, so it cannot retro-link a login that already exists.
// Several role accounts (principal, accountant, counsellor, owner) were created
// without staff linkage, which breaks any action that records a staff_id
// (e.g. principal leave approvals → 403 "missing staff linkage").
//
// Admin-scoped, school-scoped. Idempotent: safe to call repeatedly.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const VALID_ROLES = new Set(['teacher', 'principal', 'admin', 'counsellor', 'admin_staff', 'accountant', 'owner']);

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

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const role = typeof body.role === 'string' ? body.role : '';
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: `role must be one of: ${Array.from(VALID_ROLES).join(', ')}` }, { status: 400 });
  }

  // 1) Find the existing login in THIS school.
  const { data: login, error: loginErr } = await supabaseAdmin
    .from('school_users')
    .select('id, email, role, role_v2, staff_id, name, institution_id')
    .eq('school_id', schoolId)
    .eq('email', email)
    .maybeSingle();
  if (loginErr) return NextResponse.json({ error: `Login lookup failed: ${loginErr.message}` }, { status: 500 });
  if (!login) return NextResponse.json({ error: 'No login found for that email in this school' }, { status: 404 });

  // 2) If already linked, return idempotently.
  if (login.staff_id) {
    return NextResponse.json({ success: true, already_linked: true, staff_id: login.staff_id });
  }

  // 3) Find or create a staff record for this email in this school.
  const { data: existingStaff, error: staffLookupErr } = await supabaseAdmin
    .from('staff')
    .select('id')
    .eq('school_id', schoolId)
    .eq('email', email)
    .maybeSingle();
  if (staffLookupErr) return NextResponse.json({ error: `Staff lookup failed: ${staffLookupErr.message}` }, { status: 500 });

  let staffId = existingStaff?.id ?? null;
  if (!staffId) {
    const { data: newStaff, error: createErr } = await supabaseAdmin
      .from('staff')
      .insert({
        school_id: schoolId,
        institution_id: login.institution_id ?? null,
        name: name ?? login.name ?? email,
        role,
        email,
        is_active: true,
      })
      .select('id')
      .single();
    if (createErr || !newStaff) return NextResponse.json({ error: `Staff create failed: ${createErr?.message}` }, { status: 500 });
    staffId = newStaff.id;
  }

  // 4) Link the login to the staff record and set role_v2.
  const { error: linkErr } = await supabaseAdmin
    .from('school_users')
    .update({ staff_id: staffId, role_v2: role })
    .eq('id', login.id)
    .eq('school_id', schoolId);
  if (linkErr) return NextResponse.json({ error: `Link failed: ${linkErr.message}` }, { status: 500 });

  return NextResponse.json({ success: true, linked: true, staff_id: staffId, role_v2: role });
}
