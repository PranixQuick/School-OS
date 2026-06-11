import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// GET /api/admin/payroll/structures
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (ctx.userRole === 'viewer') return NextResponse.json({ error: 'Read-only' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('payroll_salary_structures')
    .select(`
      id, staff_id, basic_salary, hra, da, conveyance, medical_allowance, other_allowance,
      gross_salary, pf_employer_pct, pf_employee_pct, esi_applicable, pt_state,
      tds_placeholder, other_deduction, effective_from, is_active,
      staff!inner(id, name, designation, department_id)
    `)
    .eq('school_id', ctx.schoolId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ structures: data ?? [] });
}

// POST /api/admin/payroll/structures
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (!['owner','admin','principal'].includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { staff_id, basic_salary, hra, da, conveyance, medical_allowance, other_allowance,
    pf_employer_pct, pf_employee_pct, esi_applicable, pt_state, tds_placeholder,
    other_deduction, effective_from } = body as Record<string, unknown>;

  if (!staff_id || !basic_salary) {
    return NextResponse.json({ error: 'staff_id and basic_salary are required' }, { status: 400 });
  }

  // Deactivate existing structure
  await supabaseAdmin.from('payroll_salary_structures')
    .update({ is_active: false })
    .eq('school_id', ctx.schoolId)
    .eq('staff_id', staff_id as string)
    .eq('is_active', true);

  const { data, error } = await supabaseAdmin
    .from('payroll_salary_structures')
    .insert({
      school_id: ctx.schoolId,
      staff_id: staff_id as string,
      basic_salary: Number(basic_salary) || 0,
      hra: Number(hra) || 0,
      da: Number(da) || 0,
      conveyance: Number(conveyance) || 0,
      medical_allowance: Number(medical_allowance) || 0,
      other_allowance: Number(other_allowance) || 0,
      pf_employer_pct: Number(pf_employer_pct) ?? 12,
      pf_employee_pct: Number(pf_employee_pct) ?? 12,
      esi_applicable: Boolean(esi_applicable),
      pt_state: pt_state as string ?? null,
      tds_placeholder: Number(tds_placeholder) || 0,
      other_deduction: Number(other_deduction) || 0,
      effective_from: (effective_from as string) ?? new Date().toISOString().slice(0, 10),
      is_active: true,
      created_by: ctx.userId,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ structure: data }, { status: 201 });
}
