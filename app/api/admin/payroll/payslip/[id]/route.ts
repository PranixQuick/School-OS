import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/payroll/payslip/[id] — generate payslip PDF
export async function GET(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { id } = await params;

  // Fetch payslip + run + staff
  const { data: slip } = await supabaseAdmin
    .from('payroll_payslips')
    .select(`
      id, basic_salary, hra, da, conveyance, medical_allowance, other_allowance,
      gross_salary, working_days, days_present, days_absent,
      adjusted_gross, pf_employee, pf_employer, esi_employee,
      professional_tax, tds, other_deduction, total_deductions, net_salary,
      payment_status, paid_at,
      staff!inner(name, designation, department),
      payroll_runs!inner(pay_period_month, pay_period_year, status),
      school:schools!inner(name)
    `)
    .eq('id', id)
    .eq('school_id', ctx.schoolId)
    .single();

  if (!slip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const run = slip.payroll_runs as { pay_period_month: number; pay_period_year: number; status: string };
  const staff = slip.staff as { name: string; designation: string; department: string };
  const school = slip.school as { name: string };

  // Generate HTML payslip (returned as HTML for browser printing)
  const period = `${MONTHS[run.pay_period_month]} ${run.pay_period_year}`;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Payslip — ${staff.name} — ${period}</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 24px; color: #111827; font-size: 13px; }
  .header { background: #4F46E5; color: #fff; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
  .header p { margin: 4px 0 0; opacity: 0.8; font-size: 12px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .info-box { background: #F9FAFB; border-radius: 8px; padding: 14px; }
  .info-box h3 { margin: 0 0 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; }
  .info-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
  .info-row:last-child { border-bottom: none; }
  .info-row .label { color: #6B7280; }
  .info-row .value { font-weight: 600; }
  .earnings-row, .deductions-row { display: flex; justify-content: space-between; padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 10px 12px; background: #F3F4F6; color: #374151; }
  .total-row { display: flex; justify-content: space-between; padding: 10px 12px; font-weight: 800; font-size: 13px; }
  .net-pay { background: #4F46E5; color: #fff; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-top: 16px; }
  .net-pay .label { font-size: 13px; opacity: 0.8; }
  .net-pay .value { font-size: 22px; font-weight: 900; }
  .footer { margin-top: 24px; font-size: 11px; color: #9CA3AF; text-align: center; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; background: ${slip.payment_status === 'paid' ? '#D1FAE5' : '#FEF9C3'}; color: ${slip.payment_status === 'paid' ? '#065F46' : '#92400E'}; }
  @media print { body { padding: 12px; } .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${school.name}</h1>
    <p>PAYSLIP — ${period}</p>
  </div>

  <div class="grid-2">
    <div class="info-box">
      <h3>Employee Details</h3>
      <div class="info-row"><span class="label">Name</span><span class="value">${staff.name}</span></div>
      <div class="info-row"><span class="label">Designation</span><span class="value">${staff.designation}</span></div>
      <div class="info-row"><span class="label">Department</span><span class="value">${staff.department}</span></div>
    </div>
    <div class="info-box">
      <h3>Pay Period</h3>
      <div class="info-row"><span class="label">Period</span><span class="value">${period}</span></div>
      <div class="info-row"><span class="label">Working Days</span><span class="value">${slip.working_days}</span></div>
      <div class="info-row"><span class="label">Days Present</span><span class="value">${slip.days_present}</span></div>
      <div class="info-row"><span class="label">Status</span><span class="value"><span class="status-badge">${slip.payment_status.toUpperCase()}</span></span></div>
    </div>
  </div>

  <div class="grid-2">
    <div>
      <div class="section-title">Earnings</div>
      ${[
        ['Basic Salary', slip.basic_salary],
        ['HRA', slip.hra],
        ['DA', slip.da],
        ['Conveyance', slip.conveyance],
        ['Medical Allowance', slip.medical_allowance],
        ['Other Allowance', slip.other_allowance],
      ].filter(([, v]) => Number(v) > 0).map(([l, v]) =>
        `<div class="earnings-row"><span>${l}</span><span>₹${Number(v).toLocaleString('en-IN')}</span></div>`
      ).join('')}
      <div class="total-row"><span>Gross Salary</span><span>₹${Number(slip.adjusted_gross).toLocaleString('en-IN')}</span></div>
    </div>
    <div>
      <div class="section-title">Deductions</div>
      ${[
        ['PF (Employee)', slip.pf_employee],
        ['PF (Employer)', slip.pf_employer],
        ['ESI', slip.esi_employee],
        ['Professional Tax', slip.professional_tax],
        ['TDS', slip.tds],
        ['Other', slip.other_deduction],
      ].filter(([, v]) => Number(v) > 0).map(([l, v]) =>
        `<div class="deductions-row"><span>${l}</span><span>₹${Number(v).toLocaleString('en-IN')}</span></div>`
      ).join('')}
      <div class="total-row"><span>Total Deductions</span><span>₹${Number(slip.total_deductions).toLocaleString('en-IN')}</span></div>
    </div>
  </div>

  <div class="net-pay">
    <span class="label">NET PAY</span>
    <span class="value">₹${Number(slip.net_salary).toLocaleString('en-IN')}</span>
  </div>

  <div class="footer">
    This is a computer-generated payslip and does not require a signature. · ${school.name} · ${period}
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="payslip-${staff.name.replace(/\s+/g, '-')}-${run.pay_period_month}-${run.pay_period_year}.html"`,
    },
  });
}
