import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';
type Params = { params: Promise<{ id: string }> };

interface SlipRun { pay_period_month: number; pay_period_year: number; status: string; }
interface SlipStaff { name: string; designation: string; department: string; }
interface SlipSchool { name: string; }

// GET /api/admin/payroll/payslip/[id] — generate printable HTML payslip
export async function GET(req: NextRequest, { params }: Params) {
  let ctx; try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const { id } = await params;

  const { data: slip } = await supabaseAdmin
    .from('payroll_payslips')
    .select(`
      id, basic_salary, hra, da, conveyance, medical_allowance, other_allowance,
      gross_salary, working_days, days_present, days_absent, adjusted_gross,
      pf_employee, pf_employer, esi_employee, professional_tax, tds,
      other_deduction, total_deductions, net_salary, payment_status, paid_at,
      staff:staff_id(name, designation, department),
      run:run_id(pay_period_month, pay_period_year, status),
      school:school_id(name)
    `)
    .eq('id', id)
    .eq('school_id', ctx.schoolId)
    .single();

  if (!slip) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });

  const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

  // Supabase returns nested relations as objects when using column:table_id() syntax
  const run = (slip.run ?? {}) as unknown as SlipRun;
  const staff = (slip.staff ?? {}) as unknown as SlipStaff;
  const school = (slip.school ?? {}) as unknown as SlipSchool;

  const period = `${MONTHS[run.pay_period_month ?? 0]} ${run.pay_period_year ?? ''}`;
  const staffName = staff.name ?? 'Staff Member';
  const schoolName = school.name ?? 'School';

  const row = (label: string, value: number) =>
    value > 0 ? `<div class="r"><span>${label}</span><span>₹${value.toLocaleString('en-IN')}</span></div>` : '';

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Payslip — ${staffName} — ${period}</title>
<style>
body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:24px;color:#111827;font-size:13px}
.hdr{background:#4F46E5;color:#fff;padding:20px 24px;border-radius:8px;margin-bottom:20px}
.hdr h1{margin:0;font-size:18px;font-weight:800}
.hdr p{margin:4px 0 0;opacity:.8;font-size:12px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px}
.box{background:#F9FAFB;border-radius:8px;padding:14px}
.box h3{margin:0 0 10px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#6B7280}
.r{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #E5E7EB;font-size:12px}
.r:last-child{border-bottom:none}
.sec{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:8px 12px;background:#F3F4F6;color:#374151}
.tot{display:flex;justify-content:space-between;padding:9px 12px;font-weight:800;font-size:13px}
.net{background:#4F46E5;color:#fff;border-radius:8px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin-top:16px}
.net .lbl{font-size:13px;opacity:.8}
.net .val{font-size:22px;font-weight:900}
.ft{margin-top:20px;font-size:10px;color:#9CA3AF;text-align:center}
@media print{body{padding:12px}.hdr{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr"><h1>${schoolName}</h1><p>PAYSLIP — ${period}</p></div>
<div class="g2">
  <div class="box"><h3>Employee</h3>
    <div class="r"><span>Name</span><span><b>${staffName}</b></span></div>
    <div class="r"><span>Designation</span><span>${staff.designation ?? '—'}</span></div>
    <div class="r"><span>Department</span><span>${staff.department ?? '—'}</span></div>
  </div>
  <div class="box"><h3>Pay Period</h3>
    <div class="r"><span>Period</span><span><b>${period}</b></span></div>
    <div class="r"><span>Working Days</span><span>${slip.working_days}</span></div>
    <div class="r"><span>Days Present</span><span>${slip.days_present}</span></div>
    <div class="r"><span>Status</span><span>${(slip.payment_status ?? '').toUpperCase()}</span></div>
  </div>
</div>
<div class="g2">
  <div>
    <div class="sec">Earnings</div>
    ${row('Basic Salary', Number(slip.basic_salary))}
    ${row('HRA', Number(slip.hra))}
    ${row('DA', Number(slip.da))}
    ${row('Conveyance', Number(slip.conveyance))}
    ${row('Medical Allowance', Number(slip.medical_allowance))}
    ${row('Other Allowance', Number(slip.other_allowance))}
    <div class="tot"><span>Gross Salary</span><span>₹${Number(slip.adjusted_gross).toLocaleString('en-IN')}</span></div>
  </div>
  <div>
    <div class="sec">Deductions</div>
    ${row('PF Employee', Number(slip.pf_employee))}
    ${row('PF Employer', Number(slip.pf_employer))}
    ${row('ESI', Number(slip.esi_employee))}
    ${row('Professional Tax', Number(slip.professional_tax))}
    ${row('TDS', Number(slip.tds))}
    ${row('Other', Number(slip.other_deduction))}
    <div class="tot"><span>Total Deductions</span><span>₹${Number(slip.total_deductions).toLocaleString('en-IN')}</span></div>
  </div>
</div>
<div class="net"><span class="lbl">NET PAY</span><span class="val">₹${Number(slip.net_salary).toLocaleString('en-IN')}</span></div>
<div class="ft">Computer-generated payslip · ${schoolName} · ${period}</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `inline; filename="payslip-${staffName.replace(/\s+/g,'-')}-${run.pay_period_month}-${run.pay_period_year}.html"`,
    },
  });
}
