import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// GET — list payroll runs
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { data, error } = await supabaseAdmin
    .from('payroll_runs')
    .select('id, pay_period_month, pay_period_year, status, total_staff, total_gross, total_deductions, total_net, created_at, approved_at')
    .eq('school_id', ctx.schoolId)
    .order('pay_period_year', { ascending: false })
    .order('pay_period_month', { ascending: false })
    .limit(24);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data ?? [] });
}

// POST — create a new payroll run for a month
export async function POST(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (!['owner','admin','accountant'].includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { pay_period_month, pay_period_year, notes } = body as {
    pay_period_month?: number; pay_period_year?: number; notes?: string;
  };

  if (!pay_period_month || !pay_period_year) {
    return NextResponse.json({ error: 'pay_period_month and pay_period_year are required' }, { status: 400 });
  }

  // Check no duplicate
  const { data: existing } = await supabaseAdmin
    .from('payroll_runs').select('id')
    .eq('school_id', ctx.schoolId)
    .eq('pay_period_month', pay_period_month)
    .eq('pay_period_year', pay_period_year).single();

  if (existing) return NextResponse.json({ error: 'Payroll run already exists for this period' }, { status: 409 });

  // Get all active salary structures
  const { data: structures } = await supabaseAdmin
    .from('payroll_salary_structures')
    .select('staff_id, basic_salary, hra, da, conveyance, medical_allowance, other_allowance, gross_salary, pf_employee_pct, pf_employer_pct, esi_applicable, professional_tax:pt_state, tds_placeholder, other_deduction')
    .eq('school_id', ctx.schoolId)
    .eq('is_active', true);

  const staffCount = structures?.length ?? 0;
  const totalGross = structures?.reduce((sum, s) => sum + Number(s.gross_salary || 0), 0) ?? 0;
  const totalDeductions = structures?.reduce((sum, s) => {
    const gross = Number(s.gross_salary || 0);
    const pf = (gross * Number(s.pf_employee_pct || 12)) / 100;
    const tds = Number(s.tds_placeholder || 0);
    const other = Number(s.other_deduction || 0);
    return sum + pf + tds + other;
  }, 0) ?? 0;
  const totalNet = totalGross - totalDeductions;

  const { data: run, error } = await supabaseAdmin
    .from('payroll_runs')
    .insert({
      school_id: ctx.schoolId,
      pay_period_month,
      pay_period_year,
      status: 'draft',
      total_staff: staffCount,
      total_gross: totalGross,
      total_deductions: totalDeductions,
      total_net: totalNet,
      notes: notes ?? null,
      created_by: ctx.userId,
    })
    .select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate payslips for all staff
  if (structures && structures.length > 0) {
    const payslips = structures.map(s => {
      const gross = Number(s.gross_salary || 0);
      const pfEmp = (gross * Number(s.pf_employee_pct || 12)) / 100;
      const pfEmployer = (gross * Number(s.pf_employer_pct || 12)) / 100;
      const tds = Number(s.tds_placeholder || 0);
      const other = Number(s.other_deduction || 0);
      const totalDed = pfEmp + tds + other;
      return {
        school_id: ctx.schoolId, run_id: run.id,
        staff_id: s.staff_id, basic_salary: Number(s.basic_salary || 0),
        hra: Number(s.hra || 0), da: Number(s.da || 0),
        conveyance: Number(s.conveyance || 0), medical_allowance: Number(s.medical_allowance || 0),
        other_allowance: Number(s.other_allowance || 0), gross_salary: gross,
        working_days: 26, days_present: 26, days_absent: 0, leave_days_paid: 0,
        adjusted_gross: gross, pf_employee: pfEmp, pf_employer: pfEmployer,
        esi_employee: 0, esi_employer: 0, professional_tax: 0,
        tds, other_deduction: other, total_deductions: totalDed,
        net_salary: gross - totalDed, payment_status: 'pending',
      };
    });
    await supabaseAdmin.from('payroll_payslips').insert(payslips);
  }

  return NextResponse.json({ run }, { status: 201 });
}
