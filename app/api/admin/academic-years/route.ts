// app/api/admin/academic-years/route.ts
// Real workflow: end of April → admin creates new year → promotes students → closes old year
// Promotion = increment class by 1 for all active students. Final-year = graduate.
// Simple, no automation — admin triggers it explicitly.
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
  const institutionId = school?.institution_id;

  if (!institutionId) return NextResponse.json({ years: [] });

  const { data, error } = await supabaseAdmin
    .from('academic_years').select('*')
    .eq('institution_id', institutionId)
    .order('start_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ years: data ?? [] });
}

export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { label: string; start_date: string; end_date: string; set_current?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.label || !body.start_date || !body.end_date) return NextResponse.json({ error: 'label, start_date, end_date required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();
  if (!school?.institution_id) return NextResponse.json({ error: 'Institution not found' }, { status: 404 });

  // Unset current if setting new one
  if (body.set_current) {
    await supabaseAdmin.from('academic_years').update({ is_current: false }).eq('institution_id', school.institution_id);
  }

  const { data, error } = await supabaseAdmin.from('academic_years').insert({
    institution_id: school.institution_id,
    school_id: schoolId,
    label: body.label,
    start_date: body.start_date,
    end_date: body.end_date,
    is_current: body.set_current ?? false,
    status: 'active',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, year: data });
}

export async function PATCH(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;

  let body: { id: string; action: 'set_current' | 'close' | 'promote'; final_classes?: string[]; notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!body.id || !body.action) return NextResponse.json({ error: 'id and action required' }, { status: 400 });

  const { data: school } = await supabaseAdmin.from('schools').select('institution_id').eq('id', schoolId).maybeSingle();

  if (body.action === 'set_current') {
    if (school?.institution_id) {
      await supabaseAdmin.from('academic_years').update({ is_current: false }).eq('institution_id', school.institution_id);
    }
    await supabaseAdmin.from('academic_years').update({ is_current: true }).eq('id', body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === 'close') {
    await supabaseAdmin.from('academic_years').update({ is_current: false, status: 'closed' }).eq('id', body.id);
    return NextResponse.json({ success: true });
  }

  if (body.action === 'promote') {
    // PROMOTE: increment class level for all active students
    // final_classes = classes that graduate instead of promoting (e.g. ['10', '12'])
    // Real workflow: admin reviews, then clicks promote. No auto-trigger.
    const finalClasses = new Set(body.final_classes ?? ['10', '12']);

    const { data: students } = await supabaseAdmin
      .from('students').select('id, name, class')
      .eq('school_id', schoolId).eq('is_active', true);

    let promoted = 0, graduated = 0, errors = 0;
    for (const s of students ?? []) {
      try {
        if (finalClasses.has(s.class)) {
          await supabaseAdmin.from('students').update({ is_active: false, graduation_status: 'graduated', graduated_at: new Date().toISOString() }).eq('id', s.id);
          graduated++;
        } else {
          const classNum = parseInt(s.class);
          if (!isNaN(classNum)) {
            await supabaseAdmin.from('students').update({ class: String(classNum + 1) }).eq('id', s.id);
            promoted++;
          }
        }
      } catch { errors++; }
    }

    // Log promotion
    await supabaseAdmin.from('promotion_logs').insert({
      school_id: schoolId,
      academic_year_id: body.id,
      promoted_by: ctx.userEmail,
      total_students: (students ?? []).length,
      promoted_count: promoted,
      graduated_count: graduated,
      retained_count: 0,
      unmatched_count: errors,
      status: errors > 0 ? 'partial' : 'completed',
    });

    return NextResponse.json({ success: true, promoted, graduated, errors });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
