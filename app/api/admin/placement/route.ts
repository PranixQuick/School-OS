// app/api/admin/placement/route.ts
// Real workflow: placement officer adds company → schedules drive → records who got selected
// Simple CRUD. No automated ATS integration. Export to Excel for company sharing.
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ companies: [], drives: [] });

  const view = req.nextUrl.searchParams.get('view') ?? 'drives';

  if (view === 'companies') {
    const { data, error } = await supabaseAdmin.from('placement_companies')
      .select('*').eq('institution_id', school.institution_id)
      .eq('is_active', true).order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ companies: data ?? [] });
  }

  if (view === 'outcomes') {
    const drive_id = req.nextUrl.searchParams.get('drive_id');
    if (!drive_id) return NextResponse.json({ error: 'drive_id required for outcomes view' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('placement_outcomes')
      .select('*, student:students(name, class, batch_id)')
      .eq('drive_id', drive_id).order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ outcomes: data ?? [] });
  }

  // Default: drives with summary counts
  const { data: drives, error } = await supabaseAdmin.from('placement_drives')
    .select('*, company:placement_companies(name, sector)')
    .eq('institution_id', school.institution_id)
    .order('drive_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach outcome counts
  const driveIds = (drives ?? []).map(d => d.id);
  const { data: outcomes } = await supabaseAdmin.from('placement_outcomes')
    .select('drive_id, outcome').in('drive_id', driveIds);
  const stats: Record<string, { applied: number; selected: number }> = {};
  for (const o of outcomes ?? []) {
    if (!stats[o.drive_id]) stats[o.drive_id] = { applied: 0, selected: 0 };
    stats[o.drive_id].applied++;
    if (o.outcome === 'selected') stats[o.drive_id].selected++;
  }

  return NextResponse.json({ drives: (drives ?? []).map(d => ({ ...d, stats: stats[d.id] ?? { applied: 0, selected: 0 } })) });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { action: 'add_company' | 'add_drive' | 'record_outcome'; [key: string]: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  if (body.action === 'add_company') {
    const { name, sector, contact_name, contact_email, contact_phone } = body as any;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('placement_companies').insert({
      institution_id: school.institution_id, school_id: schoolId,
      name, sector: sector ?? null, contact_name: contact_name ?? null,
      contact_email: contact_email ?? null, contact_phone: contact_phone ?? null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, company: data });
  }

  if (body.action === 'add_drive') {
    const { company_id, title, drive_date, package_lpa, package_max_lpa, eligible_departments, min_cgpa, backlogs_allowed, academic_year_id } = body as any;
    if (!company_id || !title) return NextResponse.json({ error: 'company_id and title required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('placement_drives').insert({
      institution_id: school.institution_id, school_id: schoolId,
      company_id, title, drive_date: drive_date ?? null,
      package_lpa: package_lpa ?? null, package_max_lpa: package_max_lpa ?? null,
      eligible_departments: eligible_departments ?? null,
      min_cgpa: min_cgpa ?? null, backlogs_allowed: backlogs_allowed ?? false,
      academic_year_id: academic_year_id ?? null,
      status: 'upcoming',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, drive: data });
  }

  if (body.action === 'record_outcome') {
    const { drive_id, student_id, outcome, package_lpa, offer_date } = body as any;
    if (!drive_id || !student_id || !outcome) return NextResponse.json({ error: 'drive_id, student_id, outcome required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('placement_outcomes').upsert({
      institution_id: school.institution_id, school_id: schoolId,
      drive_id, student_id, outcome,
      package_lpa: package_lpa ?? null,
      offer_date: offer_date ?? null,
    }, { onConflict: 'drive_id,student_id' }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, outcome: data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
