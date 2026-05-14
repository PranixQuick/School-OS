// app/api/admin/health-incidents/route.ts
// Batch 4E — School-wide health incidents log with filters.
// TODO(item-15): migrate to supabaseForUser

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

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10);
  const to = searchParams.get('to') ?? new Date().toISOString().slice(0,10);
  const classFilter = searchParams.get('class');
  const typeFilter = searchParams.get('incident_type');

  let query = supabaseAdmin
    .from('health_incidents')
    .select('id, incident_date, incident_type, description, first_aid_given, referred_to_hospital, parent_notified, notified_at, recorded_by, students(name, class, section), staff(name)')
    .eq('school_id', schoolId)
    .gte('incident_date', from)
    .lte('incident_date', to)
    .order('incident_date', { ascending: false });

  if (typeFilter) query = query.eq('incident_type', typeFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let incidents = (data ?? []).map(i => {
    const st = Array.isArray(i.students) ? i.students[0] : i.students as { name?: string; class?: string; section?: string } | null;
    const rec = Array.isArray(i.staff) ? i.staff[0] : i.staff as { name?: string } | null;
    return {
      id: i.id, incident_date: i.incident_date, incident_type: i.incident_type,
      description: i.description, first_aid_given: i.first_aid_given,
      referred_to_hospital: i.referred_to_hospital, parent_notified: i.parent_notified,
      student_name: st?.name ?? '—', student_class: st?.class, student_section: st?.section,
      recorded_by_name: rec?.name ?? '—',
    };
  });

  if (classFilter) incidents = incidents.filter(i => i.student_class === classFilter);

  return NextResponse.json({ incidents, count: incidents.length, from, to });
}
