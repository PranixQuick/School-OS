// app/api/onboarding/context/route.ts
// Returns institution context for the onboarding wizard to render
// polymorphically (step list, required steps, labels per institution type).
//
// Reads from the canonical institutions table joined to schools.
// As of P1, /api/config has also been fixed to use this same source of truth.
//
// Returns:
//   {
//     school_id, school_name,
//     institution_type,    // canonical enum value from institutions table
//     ownership_type,      // canonical text value from institutions table
//     // Derived flags for convenience — wizard can use these instead of
//     // hard-coding type lists.
//     is_government, is_higher_education, is_pre_primary, is_coaching, is_anganwadi
//   }

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const GOVT_TYPES = new Set([
  'govt_school', 'govt_aided_school', 'welfare_school', 'anganwadi',
]);
const HIGHER_ED_TYPES = new Set([
  'degree_college', 'engineering', 'polytechnic', 'mba', 'medical',
  'university', 'junior_college', 'intermediate_college',
]);
const PRE_PRIMARY_TYPES = new Set([
  'pre_school', 'kg', 'anganwadi',
]);
const COACHING_TYPES = new Set([
  'coaching', 'coaching_center', 'tuition_center',
]);

export async function GET(req: NextRequest) {
  let ctx;
  try {
    ctx = await requireAdminSession(req);
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { schoolId } = ctx;

  const { data: school, error: schoolErr } = await supabaseAdmin
    .from('schools')
    .select('id, name, institution_id, is_active')
    .eq('id', schoolId)
    .maybeSingle();

  if (schoolErr || !school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 });
  }

  let institutionType = 'school_k12';
  let ownershipType = 'private';

  if (school.institution_id) {
    const { data: institution } = await supabaseAdmin
      .from('institutions')
      .select('institution_type, ownership_type, is_active')
      .eq('id', school.institution_id)
      .maybeSingle();

    if (institution) {
      institutionType = institution.institution_type ?? institutionType;
      ownershipType = institution.ownership_type ?? ownershipType;
    }
  }

  return NextResponse.json({
    school_id: school.id,
    school_name: school.name,
    institution_type: institutionType,
    ownership_type: ownershipType,
    is_government: GOVT_TYPES.has(institutionType) || ownershipType === 'government',
    is_higher_education: HIGHER_ED_TYPES.has(institutionType),
    is_pre_primary: PRE_PRIMARY_TYPES.has(institutionType),
    is_coaching: COACHING_TYPES.has(institutionType),
    is_anganwadi: institutionType === 'anganwadi',
  });
}
