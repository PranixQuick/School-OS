// app/api/meo/institutions/route.ts
// MEO → Institution + Principal provisioning. Middle of the government chain:
//   DEO adds MEO → MEO onboards an institution and grants ONE access (principal)
//   → principal onboards admin/staff (via existing /api/admin/staff).
//
// Role-scoped: only 'meo' may POST, and only within their OWN mandal
// (jurisdiction confinement — an MEO cannot create schools in another mandal).
// The MEO grants exactly one principal login per institution; further onboarding
// is the principal's responsibility, NOT the MEO's. The MEO can VIEW everything
// under their mandal (GET), matching the visibility model.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveMeoMandal(userId: string) {
  const { data } = await supabaseAdmin
    .from('meo_mandal_mapping')
    .select('mandal_code, mandal_name, district_code, district_name, state_code, state_name')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return data;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
    + '-' + Math.random().toString(36).slice(2, 7);
}

// GET — list institutions the MEO oversees (their mandal jurisdiction).
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['meo', 'admin', 'owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'MEO role required' }, { status: 403 });
  }
  if (session.userRole === 'meo') {
    const mandal = await resolveMeoMandal(session.userId);
    if (!mandal) return NextResponse.json({ error: 'MEO mandal not configured' }, { status: 403 });
    const { data, error } = await supabaseAdmin
      .from('v_meo_school_summary')
      .select('school_id, school_name, udise_code, total_students, compliance_score')
      .eq('mandal_code', mandal.mandal_code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ mandal: mandal.mandal_name, institutions: data ?? [], count: (data ?? []).length });
  }
  return NextResponse.json({ institutions: [], count: 0 });
}

// POST — MEO registers an institution under their mandal + grants principal access.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.userRole !== 'meo') {
    return NextResponse.json({ error: `Role '${session.userRole}' is not permitted to onboard institutions` }, { status: 403 });
  }

  const mandal = await resolveMeoMandal(session.userId);
  if (!mandal) return NextResponse.json({ error: 'MEO mandal not configured' }, { status: 403 });

  let body: {
    institution_name?: string; udise_code?: string;
    principal_name?: string; principal_email?: string;
    institution_type?: string;
  } | null = null;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const institutionName = body?.institution_name?.trim();
  const principalName = body?.principal_name?.trim();
  const principalEmail = body?.principal_email?.trim().toLowerCase();
  if (!institutionName || !principalName || !principalEmail) {
    return NextResponse.json({ error: 'institution_name, principal_name and principal_email are required' }, { status: 400 });
  }

  // Default to government school; overridable for the multi-institution-type model.
  const institutionType = body?.institution_type?.trim() || 'govt_school';

  // 1) Resolve the government organisation (institutions.organisation_id is NOT NULL).
  const { data: siblingInst } = await supabaseAdmin
    .from('institutions')
    .select('organisation_id, ownership_type')
    .limit(1)
    .maybeSingle();
  const organisationId = siblingInst?.organisation_id ?? null;
  if (!organisationId) {
    return NextResponse.json({ error: 'Could not resolve government organisation for this district' }, { status: 500 });
  }

  // 2) Create the institution record with all required columns. Fail loudly.
  const { data: inst, error: instErr } = await supabaseAdmin
    .from('institutions')
    .insert({
      organisation_id: organisationId,
      name: institutionName,
      slug: slugify(institutionName),
      institution_type: institutionType,
      ownership_type: siblingInst?.ownership_type ?? 'government',
      settings: { udise_code: body?.udise_code ?? null, mandal_code: mandal.mandal_code, district_code: mandal.district_code },
    })
    .select('id')
    .single();
  if (instErr || !inst) {
    return NextResponse.json({ error: `Institution create failed: ${instErr?.message}` }, { status: 500 });
  }
  const institutionId: string = inst.id;

  // 2) Create the school under this MEO's mandal jurisdiction.
  const { data: school, error: schoolErr } = await supabaseAdmin
    .from('schools')
    .insert({
      name: institutionName,
      slug: slugify(institutionName),
      plan: 'starter',
      is_active: true,
      institution_id: institutionId,
    })
    .select('id')
    .single();
  if (schoolErr || !school) {
    return NextResponse.json({ error: `Institution create failed: ${schoolErr?.message}` }, { status: 500 });
  }

  // 3) Grant the ONE access the MEO is allowed to grant: the principal login.
  //    Further onboarding (admin/staff) is the principal's job, not the MEO's.
  const { data: existingLogin } = await supabaseAdmin
    .from('school_users')
    .select('id')
    .eq('school_id', school.id)
    .eq('email', principalEmail)
    .maybeSingle();

  if (!existingLogin) {
    const { error: loginErr } = await supabaseAdmin
      .from('school_users')
      .insert({
        school_id: school.id,
        institution_id: institutionId,
        email: principalEmail,
        name: principalName,
        role: 'principal',
        role_v2: 'principal',
        is_active: true,
        invite_status: 'pending',
      });
    if (loginErr) {
      return NextResponse.json({ error: `Principal grant failed: ${loginErr.message}`, school_id: school.id }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    school_id: school.id,
    institution_id: institutionId,
    mandal_code: mandal.mandal_code,
    principal_granted: principalEmail,
    note: 'Principal must complete password setup, then onboards admin/staff.',
  });
}
