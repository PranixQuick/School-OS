// app/api/admin/programmes/route.ts
// Programme management for higher-ed institutions
// Real workflow: college academic office creates programmes at institution setup
// e.g. "B.Tech CSE", "MBA (Finance)", "B.Pharm" — with duration and semester info
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
  if (!school?.institution_id) return NextResponse.json({ programmes: [] });

  const { data, error } = await supabaseAdmin
    .from('programmes')
    .select('id, code, name, duration_years, has_semesters, credit_system, is_active, description, department_id, department:department_id(name, code)')
    .eq('institution_id', school.institution_id)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ programmes: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { code, name, duration_years, has_semesters, credit_system, department_id, description } = body;
  if (!code || !name) return NextResponse.json({ error: 'code and name required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('programmes')
    .insert({
      institution_id: school.institution_id,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      duration_years: duration_years ? Number(duration_years) : 3,
      has_semesters: Boolean(has_semesters ?? true),
      credit_system: Boolean(credit_system ?? false),
      grading_schema: {},
      department_id: department_id ? String(department_id) : null,
      description: description ? String(description).trim() : null,
      is_active: true,
    })
    .select('id, code, name, duration_years, has_semesters, is_active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, programme: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  const update: Record<string, unknown> = {};
  const editable = ['code', 'name', 'duration_years', 'has_semesters', 'credit_system', 'department_id', 'description', 'is_active'];
  for (const k of editable) {
    if (k in fields) update[k] = fields[k] === '' ? null : fields[k];
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('programmes').update(update).eq('id', String(id))
    .eq('institution_id', school?.institution_id ?? '')
    .select('id, code, name, is_active').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, programme: data });
}
