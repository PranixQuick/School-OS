// app/api/hod/directives/route.ts
// HOD directives (workflow #9). An HOD sends a directive to staff, scoped to
// their institution or all branches of the organisation. Recipients (teachers)
// plus the principal(s) and owner are notified via staff_alerts.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requireHodSession } from '@/lib/hod-auth';
import { createStaffAlerts } from '@/lib/alerts';

export const runtime = 'nodejs';

// Resolve every active school under the organisation of the HOD's origin school.
async function orgSchoolIds(originSchoolId: string): Promise<{ organisationId: string | null; schoolIds: string[] }> {
  const { data: sch } = await supabaseAdmin.from('schools').select('institution_id').eq('id', originSchoolId).maybeSingle();
  const institutionId = (sch?.institution_id as string | null) ?? null;
  if (!institutionId) return { organisationId: null, schoolIds: [originSchoolId] };

  const { data: inst } = await supabaseAdmin.from('institutions').select('organisation_id').eq('id', institutionId).maybeSingle();
  const organisationId = (inst?.organisation_id as string | null) ?? null;
  if (!organisationId) return { organisationId: null, schoolIds: [originSchoolId] };

  const { data: insts } = await supabaseAdmin.from('institutions').select('id').eq('organisation_id', organisationId);
  const instIds = (insts ?? []).map(i => i.id as string);
  const { data: schools } = await supabaseAdmin
    .from('schools').select('id')
    .in('institution_id', instIds.length ? instIds : [institutionId])
    .eq('is_active', true);
  return { organisationId, schoolIds: (schools ?? []).map(s => s.id as string) };
}

export async function GET(req: NextRequest) {
  try {
    const hod = await requireHodSession(req);
    const { data, error } = await supabaseAdmin
      .from('hod_directives')
      .select('id, scope, title, body, priority, department, created_at')
      .eq('created_by', hod.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ directives: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const hod = await requireHodSession(req);
    const payload = await req.json().catch(() => ({}));
    const { scope, title, body, priority } = payload as Record<string, any>;
    if (!title || !body) return NextResponse.json({ error: 'title and body are required' }, { status: 400 });

    const useScope = scope === 'all_branches' ? 'all_branches' : 'institution';
    const originSchool = hod.schoolIds[0];
    const dept = hod.departments[0] ?? null;

    let targetSchools = hod.schoolIds;
    let organisationId: string | null = null;
    if (useScope === 'all_branches') {
      const r = await orgSchoolIds(originSchool);
      organisationId = r.organisationId;
      targetSchools = r.schoolIds.length ? r.schoolIds : hod.schoolIds;
    }

    const { data: directive, error } = await supabaseAdmin
      .from('hod_directives')
      .insert({
        school_id: originSchool,
        organisation_id: organisationId,
        created_by: hod.userId,
        department: dept,
        scope: useScope,
        title: String(title).slice(0, 200),
        body: String(body).slice(0, 4000),
        priority: priority === 'high' ? 'high' : 'normal',
      })
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fan out: staff (teachers) receive it; principal(s) + owner get visibility.
    const shortMsg = `${String(title).slice(0, 80)} — ${String(body).slice(0, 140)}`;
    for (const sid of targetSchools) {
      await createStaffAlerts({
        schoolId: sid,
        targetRoles: ['teacher', 'principal', 'owner'],
        type: 'hod_directive',
        module: 'directives',
        title: `HOD directive: ${String(title).slice(0, 60)}`,
        message: shortMsg,
        referenceId: directive.id,
      });
    }

    return NextResponse.json({ success: true, id: directive.id, schools_notified: targetSchools.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
