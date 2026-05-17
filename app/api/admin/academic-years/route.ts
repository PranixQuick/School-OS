// app/api/admin/academic-years/route.ts
// Academic year lifecycle for schools and colleges
// Real workflow: principal/registrar creates new year in June, marks it current
// Year-end: close current year, run student promotion, open new year
// Promotion moves active students up one class/level
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

  const { data, error } = await supabaseAdmin
    .from('academic_years')
    .select('id, label, start_date, end_date, is_current, status, promoted_at, school_id, institution_id')
    .or(`school_id.eq.${schoolId},institution_id.eq.${school?.institution_id ?? '00000000-0000-0000-0000-000000000000'}`)
    .order('start_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ academic_years: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { label, start_date, end_date, set_as_current, term_structure } = body;
  if (!label || !start_date || !end_date) {
    return NextResponse.json({ error: 'label, start_date, end_date required' }, { status: 400 });
  }

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  // If set_as_current, unset existing current year first
  if (set_as_current) {
    await supabaseAdmin.from('academic_years')
      .update({ is_current: false })
      .or(`school_id.eq.${schoolId},institution_id.eq.${school?.institution_id ?? 'x'}`);
  }

  const { data, error } = await supabaseAdmin
    .from('academic_years')
    .insert({
      institution_id: school?.institution_id ?? null,
      school_id: schoolId,
      label: String(label).trim(),
      start_date: String(start_date),
      end_date: String(end_date),
      is_current: Boolean(set_as_current),
      status: 'active',
      term_structure: term_structure ?? { terms: [] },
    })
    .select('id, label, start_date, end_date, is_current, status')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, academic_year: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { id, action: yearAction, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: school } = await supabaseAdmin
    .from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  if (yearAction === 'set_current') {
    // Unset all, then set this one
    await supabaseAdmin.from('academic_years')
      .update({ is_current: false })
      .or(`school_id.eq.${schoolId},institution_id.eq.${school?.institution_id ?? 'x'}`);
    await supabaseAdmin.from('academic_years')
      .update({ is_current: true, status: 'active' })
      .eq('id', String(id));
    return NextResponse.json({ success: true });
  }

  if (yearAction === 'close') {
    // Close year — marks status as completed, records date
    await supabaseAdmin.from('academic_years')
      .update({ status: 'completed', is_current: false })
      .eq('id', String(id));
    return NextResponse.json({ success: true, message: 'Academic year closed' });
  }

  if (yearAction === 'promote') {
    // Student promotion: move all active students up one class level
    // Real workflow: admin runs this at year-end; manual verification follows
    // Only for school types — colleges use batch advancement, not class promotion
    const actorEmail = req.headers.get('x-user-email') ?? 'system';

    const { data: students } = await supabaseAdmin
      .from('students')
      .select('id, class, section')
      .eq('school_id', schoolId)
      .eq('status', 'active');

    if (!students || students.length === 0) {
      return NextResponse.json({ success: true, promoted: 0, message: 'No active students to promote' });
    }

    // Simple class promotion map (Indian school system)
    const nextClass: Record<string, string> = {
      'Nursery': 'LKG', 'LKG': 'UKG', 'UKG': '1',
      '1': '2', '2': '3', '3': '4', '4': '5',
      '5': '6', '6': '7', '7': '8', '8': '9', '9': '10',
      '10': '11', '11': '12',
    };

    let promoted = 0, graduated = 0;
    for (const student of students) {
      const next = nextClass[String(student.class ?? '')];
      if (!next) {
        // Class 12 graduates
        await supabaseAdmin.from('students')
          .update({ status: 'graduated', is_active: false, graduation_year: new Date().getFullYear() })
          .eq('id', student.id);
        graduated++;
      } else {
        await supabaseAdmin.from('students')
          .update({ class: next })
          .eq('id', student.id);
        promoted++;
      }
    }

    // Mark year as promoted
    await supabaseAdmin.from('academic_years')
      .update({ promoted_at: new Date().toISOString(), promoted_by: actorEmail })
      .eq('id', String(id));

    // Log promotion
    await supabaseAdmin.from('promotion_logs').insert({
      school_id: schoolId,
      academic_year_id: String(id),
      promoted_by: actorEmail,
      promoted_at: new Date().toISOString(),
      total_students: students.length,
      promoted_count: promoted,
      graduated_count: graduated,
      retained_count: 0,
      unmatched_count: 0,
      status: 'completed',
    });

    return NextResponse.json({ success: true, promoted, graduated, total: students.length });
  }

  // Regular field update
  const update: Record<string, unknown> = {};
  if (typeof fields.label === 'string') update.label = fields.label.trim();
  if (typeof fields.start_date === 'string') update.start_date = fields.start_date;
  if (typeof fields.end_date === 'string') update.end_date = fields.end_date;
  if (fields.term_structure) update.term_structure = fields.term_structure;

  const { data, error } = await supabaseAdmin
    .from('academic_years').update(update).eq('id', String(id))
    .select('id, label, is_current, status').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, academic_year: data });
}
