// app/api/config/route.ts
// Returns current session context: role + institution_type for Layout navigation filtering.
// P1 fix: institution_type and ownership_type are now read from the canonical
// institutions table (joined via schools.institution_id), not from
// schools.settings JSONB which was effectively unpopulated and always
// returned the hardcoded fallback 'school_k12' / 'private'.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { schoolId, userRole, userEmail } = ctx;
  const { data: school } = await supabaseAdmin
    .from('schools')
    .select('name, settings, institution_id')
    .eq('id', schoolId)
    .maybeSingle();
  const settings = (school?.settings as Record<string, unknown>) ?? {};

  // P1 fix: read institution_type and ownership_type from the institutions table,
  // not from schools.settings. Falls back to schools.settings (for legacy
  // institutions that may have had them set there) and then to defaults.
  let institutionType = (settings['institution_type'] as string) ?? 'school_k12';
  let ownershipType = (settings['ownership_type'] as string) ?? 'private';

  if (school?.institution_id) {
    const { data: institution } = await supabaseAdmin
      .from('institutions')
      .select('institution_type, ownership_type')
      .eq('id', school.institution_id)
      .maybeSingle();
    if (institution) {
      institutionType = institution.institution_type ?? institutionType;
      ownershipType = institution.ownership_type ?? ownershipType;
    }
  }

  return NextResponse.json({
    role: userRole,
    userEmail,
    schoolName: school?.name ?? '',
    institution_type: institutionType,
    ownership_type: ownershipType,
    settings,
  });
}
