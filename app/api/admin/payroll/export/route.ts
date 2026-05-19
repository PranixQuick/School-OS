import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// GET /api/admin/payroll/export?run_id=xxx — CSV download
export async function GET(req: NextRequest) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  if (!['owner','admin','accountant'].includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const runId = req.nextUrl.searchParams.get('run_id');
  if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 });

  // Verify run belongs to school
  const { data: run } = await supabaseAdmin
    .from('payroll_runs').select('pay_period_month, pay_period_year, status')
    .eq('id', runId).eq('school_id', ctx.schoolId).single();
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

  // Get payslips with staff info
  const { data: slips } = await supabaseAdmin
    .from('payroll_payslips')
    .select('net_salary, gross_salary, total_deductions, basic_salary, hra, da, pf_employee, tds, payment_status, staff:staff_id(name, designation, department)')
    .eq('run_id', runId).eq('school_id', ctx.schoolId);

  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const period = `${MONTHS[run.pay_period_month]}_${run.pay_period_year}`;

  const rows: string[] = [
    'Name,Designation,Department,Basic,HRA,DA,Gross,PF Employee,TDS,Total Deductions,Net Pay,Status'
  ];

  for (const slip of slips ?? []) {
    const staff = (slip.staff ?? {}) as unknown as { name?: string; designation?: string; department?: string };
    rows.push([
      `"${staff.name ?? ''}"`,
      `"${staff.designation ?? ''}"`,
      `"${staff.department ?? ''}"`,
      slip.basic_salary ?? 0,
      slip.hra ?? 0,
      slip.da ?? 0,
      slip.gross_salary ?? 0,
      slip.pf_employee ?? 0,
      slip.tds ?? 0,
      slip.total_deductions ?? 0,
      slip.net_salary ?? 0,
      `"${slip.payment_status ?? ''}"`,
    ].join(','));
  }

  const csv = rows.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payroll-${period}.csv"`,
    },
  });
}
