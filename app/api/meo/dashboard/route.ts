// app/api/meo/dashboard/route.ts
// MEO compliance dashboard API.
// READ-ONLY — MEO sees all schools in their mandal via UDISE mandal_code prefix.
// Session must have role='meo'. Mandal scoped via meo_mandal_mapping.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSession } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Allow MEO, admin, and owner roles
  if (!['meo', 'deo', 'admin', 'owner'].includes(session.userRole)) {
    return NextResponse.json({ error: 'MEO or admin role required' }, { status: 403 });
  }

  // Get MEO's mandal mapping
  // For admin/owner roles: fall back to session school's UDISE mandal prefix
  let mandalCode: string | null = null;
  let mandalName = 'My Mandal';
  let districtName = 'District';

  if (session.userRole === 'meo') {
    const { data: mapping } = await supabaseAdmin
      .from('meo_mandal_mapping')
      .select('mandal_code, mandal_name, district_name')
      .eq('user_id', session.userId)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!mapping) return NextResponse.json({ error: 'MEO mapping not configured' }, { status: 403 });
    mandalCode   = mapping.mandal_code;
    mandalName   = mapping.mandal_name;
    districtName = mapping.district_name;
  } else {
    // Admin: use the UDISE code of their school's institution
    const { data: inst } = await supabaseAdmin
      .from('institutions')
      .select('settings')
      .eq('legacy_school_id', session.schoolId)
      .maybeSingle();

    const udise = (inst?.settings as Record<string, unknown>)?.udise_code as string | undefined;
    if (udise && udise.length >= 6) {
      mandalCode   = udise.substring(0, 6);
      mandalName   = 'Peddapalli Mandal';  // fallback
      districtName = 'Peddapalli';
    }
  }

  // Fetch all schools in this mandal via v_meo_school_summary
  const query = supabaseAdmin
    .from('v_meo_school_summary')
    .select('*')
    .order('compliance_score', { ascending: true });

  if (mandalCode) {
    query.eq('mandal_code', mandalCode);
  }

  const { data: schools, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    mandal_name:   mandalName,
    district_name: districtName,
    mandal_code:   mandalCode,
    date:          new Date().toISOString().split('T')[0],
    schools:       schools ?? [],
    total_schools: (schools ?? []).length,
    avg_compliance: (schools ?? []).length > 0
      ? Math.round((schools ?? []).reduce((s, sc) => s + (sc.compliance_score ?? 0), 0) / (schools ?? []).length)
      : 0,
  });
}
