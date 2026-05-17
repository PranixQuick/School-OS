// app/api/admin/batches/route.ts
// Batch management for colleges, coaching centres, and junior colleges
// Real workflow: admission office creates batch at start of intake (e.g. "2024-28 CSE")
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
  if (!school?.institution_id) return NextResponse.json({ batches: [] });

  const includeArchived = req.nextUrl.searchParams.get('include_archived') === '1';
  let q = supabaseAdmin
    .from('batches')
    .select('id, label, entry_year, current_level, capacity, group_code, department_id, created_at, programme_id, academic_year_id, department:department_id(name, code)')
    .eq('institution_id', school.institution_id)
    .order('entry_year', { ascending: false });

  if (!includeArchived) q = q.not('label', 'ilike', '[archived]%');

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add student count to each batch
  const batchIds = (data ?? []).map(b => b.id);
  let countMap: Record<string, number> = {};
  if (batchIds.length > 0) {
    const { data: counts } = await supabaseAdmin
      .from('students')
      .select('batch_id')
      .in('batch_id', batchIds)
      .eq('school_id', schoolId)
      .eq('status', 'active');
    for (const row of counts ?? []) {
      countMap[row.batch_id] = (countMap[row.batch_id] ?? 0) + 1;
    }
  }

  const batches = (data ?? []).map(b => ({ ...b, student_count: countMap[b.id] ?? 0 }));
  return NextResponse.json({ batches });
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

  const { label, entry_year, capacity, group_code, department_id, programme_id, academic_year_id, current_level } = body;
  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('batches')
    .insert({
      institution_id: school.institution_id,
      label: String(label).trim(),
      entry_year: entry_year ? Number(entry_year) : new Date().getFullYear(),
      capacity: capacity ? Number(capacity) : null,
      group_code: group_code ? String(group_code).trim() : null,
      department_id: department_id ? String(department_id) : null,
      programme_id: programme_id ? String(programme_id) : null,
      academic_year_id: academic_year_id ? String(academic_year_id) : null,
      current_level: current_level ? String(current_level).trim() : null,
    })
    .select('id, label, entry_year, capacity, group_code')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, batch: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, action: batchAction, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  if (batchAction === 'archive') {
    // Prefix label with [archived] — simple convention, no hard delete
    const { data: batch } = await supabaseAdmin
      .from('batches').select('label').eq('id', String(id)).maybeSingle();
    const newLabel = `[archived] ${batch?.label ?? ''}`.trim();
    await supabaseAdmin.from('batches').update({ label: newLabel }).eq('id', String(id));
    return NextResponse.json({ success: true, message: 'Batch archived' });
  }

  if (batchAction === 'transfer_students') {
    // Move all students from this batch to another batch
    const { to_batch_id } = fields;
    if (!to_batch_id) return NextResponse.json({ error: 'to_batch_id required' }, { status: 400 });
    const { count, error } = await supabaseAdmin
      .from('students')
      .update({ batch_id: String(to_batch_id) })
      .eq('batch_id', String(id))
      .eq('school_id', schoolId)
      .eq('status', 'active');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, students_transferred: count ?? 0 });
  }

  // Regular field update
  const update: Record<string, unknown> = {};
  const editableFields = ['label', 'entry_year', 'capacity', 'group_code', 'department_id', 'programme_id', 'academic_year_id', 'current_level'];
  for (const k of editableFields) {
    if (k in fields) update[k] = fields[k] === '' ? null : fields[k];
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('batches').update(update).eq('id', String(id))
    .select('id, label, entry_year').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, batch: data });
}
