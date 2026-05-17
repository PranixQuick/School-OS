// app/api/admin/batches/route.ts
// Batch management for colleges and coaching institutions
// Real workflow: new academic year → add new batch. Old batch → archive.
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
  if (!school?.institution_id) return NextResponse.json({ batches: [] });

  const academicYearId = req.nextUrl.searchParams.get('academic_year_id');
  let q = supabaseAdmin.from('batches')
    .select('*, department:departments(code, name), programme:programmes(name, code)')
    .eq('institution_id', school.institution_id)
    .order('label');
  if (academicYearId) q = q.eq('academic_year_id', academicYearId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Attach student counts
  const batches = data ?? [];
  const counts: Record<string, number> = {};
  if (batches.length) {
    const ids = batches.map(b => b.id);
    const { data: students } = await supabaseAdmin
      .from('students').select('batch_id')
      .in('batch_id', ids).eq('is_active', true);
    for (const s of students ?? []) counts[s.batch_id] = (counts[s.batch_id] ?? 0) + 1;
  }

  return NextResponse.json({ batches: batches.map(b => ({ ...b, student_count: counts[b.id] ?? 0 })) });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { label: string; entry_year?: number; capacity?: number; group_code?: string; department_id?: string; programme_id?: string; academic_year_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.label?.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin.from('batches').insert({
    institution_id: school.institution_id,
    label: body.label.trim(),
    entry_year: body.entry_year ?? new Date().getFullYear() + 1,
    capacity: body.capacity ?? null,
    group_code: body.group_code ?? null,
    department_id: body.department_id ?? null,
    programme_id: body.programme_id ?? null,
    academic_year_id: body.academic_year_id ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, batch: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { id: string; label?: string; capacity?: number; department_id?: string | null; archived?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  const update: Record<string, unknown> = {};
  if (body.label) update.label = body.label.trim();
  if (body.capacity !== undefined) update.capacity = body.capacity;
  if (body.department_id !== undefined) update.department_id = body.department_id;

  const { data, error } = await supabaseAdmin.from('batches').update(update)
    .eq('id', body.id).eq('institution_id', school?.institution_id ?? '')
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, batch: data });
}
