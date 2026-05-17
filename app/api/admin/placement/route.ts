// app/api/admin/placement/route.ts
// Placement management: companies, drives, outcomes
// Real workflow: placement officer adds company, schedules drive, marks selected students
// No complex JD management or interview scheduler — that is manual
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

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const instId = school?.institution_id ?? schoolId;

  const view = req.nextUrl.searchParams.get('view') ?? 'drives';

  if (view === 'companies') {
    const { data, error } = await supabaseAdmin
      .from('placement_companies')
      .select('id, name, sector, website, contact_name, contact_email, contact_phone, is_active, created_at')
      .eq('institution_id', instId)
      .order('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ companies: data ?? [] });
  }

  if (view === 'outcomes') {
    const drive_id = req.nextUrl.searchParams.get('drive_id');
    let q = supabaseAdmin
      .from('placement_outcomes')
      .select('id, drive_id, student_id, outcome, package_lpa, offer_date, joining_date, student:student_id(name, class, batch_id), drive:drive_id(title, company:company_id(name))')
      .eq('institution_id', instId)
      .order('created_at', { ascending: false });
    if (drive_id) q = q.eq('drive_id', drive_id);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ outcomes: data ?? [] });
  }

  // Drives
  const { data, error } = await supabaseAdmin
    .from('placement_drives')
    .select('id, title, drive_date, package_lpa, package_max_lpa, min_cgpa, backlogs_allowed, status, eligible_departments, notes, company:company_id(name, sector)')
    .eq('institution_id', instId)
    .order('drive_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drives: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  const instId = school?.institution_id ?? schoolId;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.action === 'add_company') {
    const { name, sector, contact_name, contact_email, contact_phone, website } = body;
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('placement_companies').insert({
      institution_id: instId, school_id: schoolId,
      name: String(name).trim(), sector: sector ? String(sector).trim() : null,
      contact_name: contact_name ? String(contact_name).trim() : null,
      contact_email: contact_email ? String(contact_email).trim() : null,
      contact_phone: contact_phone ? String(contact_phone).trim() : null,
      website: website ? String(website).trim() : null, is_active: true,
    }).select('id, name').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, company: data });
  }

  if (body.action === 'add_drive') {
    const { company_id, title, drive_date, package_lpa, package_max_lpa, min_cgpa, backlogs_allowed, eligible_departments, notes } = body;
    if (!company_id || !title) return NextResponse.json({ error: 'company_id and title required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('placement_drives').insert({
      institution_id: instId, school_id: schoolId,
      company_id: String(company_id), title: String(title).trim(),
      drive_date: drive_date ? String(drive_date) : null,
      package_lpa: package_lpa ? Number(package_lpa) : null,
      package_max_lpa: package_max_lpa ? Number(package_max_lpa) : null,
      min_cgpa: min_cgpa ? Number(min_cgpa) : null,
      backlogs_allowed: Boolean(backlogs_allowed ?? false),
      eligible_departments: eligible_departments ?? [],
      notes: notes ? String(notes) : null,
      status: 'upcoming',
    }).select('id, title, drive_date, status').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, drive: data });
  }

  if (body.action === 'record_outcome') {
    const { drive_id, student_id, outcome, package_lpa, offer_date, joining_date } = body;
    if (!drive_id || !student_id || !outcome) return NextResponse.json({ error: 'drive_id, student_id, outcome required' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('placement_outcomes').insert({
      institution_id: instId, school_id: schoolId,
      drive_id: String(drive_id), student_id: String(student_id),
      outcome: String(outcome), // applied | shortlisted | selected | rejected | offer_accepted | placed
      package_lpa: package_lpa ? Number(package_lpa) : null,
      offer_date: offer_date ? String(offer_date) : null,
      joining_date: joining_date ? String(joining_date) : null,
    }).select('id, outcome').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, outcome: data });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, type, ...fields } = body;
  if (!id || !type) return NextResponse.json({ error: 'id and type required' }, { status: 400 });

  if (type === 'drive') {
    const update: Record<string, unknown> = {};
    const editable = ['title', 'drive_date', 'status', 'package_lpa', 'package_max_lpa', 'notes', 'min_cgpa', 'backlogs_allowed', 'eligible_departments'];
    for (const k of editable) { if (k in fields) update[k] = fields[k]; }
    const { data, error } = await supabaseAdmin.from('placement_drives').update(update).eq('id', String(id)).select('id, title, status').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, drive: data });
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
}
