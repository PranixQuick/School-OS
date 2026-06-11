// app/api/deo/meos/route.ts
// DEO → MEO provisioning. A DEO adds/maps MEO officers to mandals within their
// district. This is the top of the government delegation chain:
//   DEO (district) → adds MEO (mandal) → MEO onboards institutions + principals.
//
// Role-scoped: only 'deo' may POST. A DEO can only map MEOs within their OWN
// district_code (jurisdiction confinement). Idempotent on (user_id).
//
// GET: list MEOs in the DEO's district.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// Resolve the calling DEO's district from their own mandal mapping rows, or from
// any existing district they already administer. For the MVP government model a
// DEO is associated with a single district_code.
async function resolveDeoDistrict(userId: string): Promise<{ district_code: string; district_name: string; state_code: string | null; state_name: string | null } | null> {
  // A DEO may have an explicit district row in a deo_district_mapping table in
  // future; for now infer from the district they oversee in meo_mandal_mapping.
  const { data } = await supabaseAdmin
    .from('meo_mandal_mapping')
    .select('district_code, district_name, state_code, state_name')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return data;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['deo', 'admin', 'owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'DEO role required' }, { status: 403 });
  }

  const district = await resolveDeoDistrict(session.userId);
  let q = supabaseAdmin
    .from('meo_mandal_mapping')
    .select('id, user_id, name, email, mandal_code, mandal_name, district_code, district_name, is_active')
    .order('mandal_name', { ascending: true });
  if (district?.district_code) q = q.eq('district_code', district.district_code);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ meos: data ?? [], count: (data ?? []).length });
}

// DELETE — DEO deactivates an MEO mapping by id (e.g. a stale/orphaned row).
export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.userRole !== 'deo') {
    return NextResponse.json({ error: `Role '${session.userRole}' is not permitted` }, { status: 403 });
  }
  const mappingId = req.nextUrl.searchParams.get('mapping_id');
  if (!mappingId) return NextResponse.json({ error: 'mapping_id query param required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('meo_mandal_mapping').update({ is_active: false }).eq('id', mappingId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, deactivated: mappingId });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.userRole !== 'deo') {
    return NextResponse.json({ error: `Role '${session.userRole}' is not permitted to add MEOs` }, { status: 403 });
  }

  let body: { meo_email?: string; mandal_code?: string; mandal_name?: string } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const meoEmail = body?.meo_email?.trim().toLowerCase();
  const mandalCode = body?.mandal_code?.trim();
  const mandalName = body?.mandal_name?.trim();
  if (!meoEmail || !mandalCode || !mandalName) {
    return NextResponse.json({ error: 'meo_email, mandal_code and mandal_name are required' }, { status: 400 });
  }

  // The DEO can only provision within their own district.
  const district = await resolveDeoDistrict(session.userId);
  if (!district?.district_code) {
    return NextResponse.json({ error: 'DEO district not configured' }, { status: 403 });
  }

  // The MEO must already have a login with role 'meo'. The DEO maps an existing
  // officer to a mandal; account creation is handled by invite-management.
  const { data: meoUser, error: userErr } = await supabaseAdmin
    .from('school_users')
    .select('id, email, name, role')
    .eq('email', meoEmail)
    .maybeSingle();
  if (userErr) return NextResponse.json({ error: `MEO lookup failed: ${userErr.message}` }, { status: 500 });
  if (!meoUser) return NextResponse.json({ error: 'No login found for that MEO email' }, { status: 404 });
  if (meoUser.role !== 'meo') {
    return NextResponse.json({ error: `That account has role '${meoUser.role}', not 'meo'` }, { status: 409 });
  }

  // Upsert the mandal mapping (idempotent on user_id). Confined to DEO's district.
  const { data: existing } = await supabaseAdmin
    .from('meo_mandal_mapping')
    .select('id')
    .eq('user_id', meoUser.id)
    .maybeSingle();

  const rowPayload = {
    user_id: meoUser.id,
    name: meoUser.name ?? meoEmail,
    email: meoEmail,
    mandal_code: mandalCode,
    mandal_name: mandalName,
    district_code: district.district_code,
    district_name: district.district_name,
    state_code: district.state_code ?? null,
    state_name: district.state_name ?? null,
    is_active: true,
  };

  if (existing?.id) {
    const { error: upErr } = await supabaseAdmin
      .from('meo_mandal_mapping').update(rowPayload).eq('id', existing.id);
    if (upErr) return NextResponse.json({ error: `Update failed: ${upErr.message}` }, { status: 500 });
    return NextResponse.json({ success: true, updated: true, meo_user_id: meoUser.id, mandal_code: mandalCode });
  }

  const { error: insErr } = await supabaseAdmin
    .from('meo_mandal_mapping').insert(rowPayload);
  if (insErr) return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 });
  return NextResponse.json({ success: true, created: true, meo_user_id: meoUser.id, mandal_code: mandalCode });
}
