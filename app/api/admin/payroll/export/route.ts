import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

interface BankRow {
  name: string;
  account: string;
  ifsc: string;
  amount: number;
  email: string | null;
  narration: string;
}

// GET /api/admin/payroll/export?run_id=xxx&format=summary|neft|icici_bizpay&skip_incomplete=1
//   summary       — human-readable payroll register (unchanged, default)
//   neft          — bank-agnostic bulk NEFT upload file
//   icici_bizpay  — ICICI Corporate (BizPay / CIB) bulk-payment template
//
// Bank formats require staff bank details (see Payroll PR-A migration). Staff
// missing an account number / IFSC (or with zero net pay) are reported and the
// file is refused unless skip_incomplete=1 — so a bank file is never silently
// short-paying someone.
export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  if (!['owner', 'admin', 'accountant'].includes(ctx.userRole)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const runId = req.nextUrl.searchParams.get('run_id');
  if (!runId) return NextResponse.json({ error: 'run_id required' }, { status: 400 });
  const format = (req.nextUrl.searchParams.get('format') ?? 'summary').toLowerCase();
  const skipIncomplete = req.nextUrl.searchParams.get('skip_incomplete') === '1';

  // Verify run belongs to school
  const { data: run } = await supabaseAdmin
    .from('payroll_runs').select('pay_period_month, pay_period_year, status')
    .eq('id', runId).eq('school_id', ctx.schoolId).single();
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 });

  const period = `${MONTHS[run.pay_period_month]}_${run.pay_period_year}`;

  // ── Summary format (unchanged human-readable register) ──
  if (format === 'summary') {
    const { data: slips } = await supabaseAdmin
      .from('payroll_payslips')
      .select('net_salary, gross_salary, total_deductions, basic_salary, hra, da, pf_employee, tds, payment_status, staff:staff_id(name, designation, department)')
      .eq('run_id', runId).eq('school_id', ctx.schoolId);

    const rows: string[] = [
      'Name,Designation,Department,Basic,HRA,DA,Gross,PF Employee,TDS,Total Deductions,Net Pay,Status',
    ];
    for (const slip of slips ?? []) {
      const staff = (slip.staff ?? {}) as unknown as { name?: string; designation?: string; department?: string };
      rows.push(csvRow([
        staff.name ?? '', staff.designation ?? '', staff.department ?? '',
        slip.basic_salary ?? 0, slip.hra ?? 0, slip.da ?? 0, slip.gross_salary ?? 0,
        slip.pf_employee ?? 0, slip.tds ?? 0, slip.total_deductions ?? 0,
        slip.net_salary ?? 0, slip.payment_status ?? '',
      ]));
    }
    return new NextResponse(rows.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll-${period}.csv"`,
      },
    });
  }

  // ── Bank bulk-payment formats ──
  const BANK_FORMATS: Record<string, { header: string[]; row: (r: BankRow) => unknown[]; filename: string }> = {
    neft: {
      header: ['Beneficiary Name', 'Account Number', 'IFSC', 'Amount', 'Payment Mode', 'Remarks'],
      row: (r) => [r.name, r.account, r.ifsc, r.amount.toFixed(2), 'NEFT', r.narration],
      filename: `bank-neft-${period}.csv`,
    },
    // ICICI Corporate (BizPay / CIB) bulk-payment template. Column order approximates
    // the common ICICI bulk NEFT template — CONFIRM against your BizPay 360 download
    // template and adjust this header/row array if your corporate template differs
    // (it is intentionally isolated here so the change is one line, not a rewrite).
    icici_bizpay: {
      header: ['PYMT_MODE', 'BENEFICIARY_NAME', 'BENEFICIARY_ACCOUNT_NO', 'IFSC_CODE', 'AMOUNT', 'BENEFICIARY_EMAIL', 'REMARKS'],
      row: (r) => ['NEFT', r.name, r.account, r.ifsc, r.amount.toFixed(2), r.email ?? '', r.narration],
      filename: `icici-bizpay-${period}.csv`,
    },
  };

  const cfg = BANK_FORMATS[format];
  if (!cfg) {
    return NextResponse.json({ error: `Unknown format '${format}'. Use summary, neft, or icici_bizpay.` }, { status: 400 });
  }

  const { data: slips } = await supabaseAdmin
    .from('payroll_payslips')
    .select('net_salary, payment_status, staff_id')
    .eq('run_id', runId).eq('school_id', ctx.schoolId);

  const staffIds = Array.from(new Set((slips ?? []).map((s) => s.staff_id).filter(Boolean))) as string[];
  const bankByStaff: Record<string, { name: string | null; account: string | null; ifsc: string | null; email: string | null }> = {};
  if (staffIds.length) {
    const { data: staffRows } = await supabaseAdmin
      .from('staff')
      .select('id, name, email, bank_account_name, bank_account_number, bank_ifsc')
      .eq('school_id', ctx.schoolId).in('id', staffIds);
    for (const s of staffRows ?? []) {
      bankByStaff[s.id as string] = {
        name: (s.bank_account_name as string) || (s.name as string) || null,
        account: (s.bank_account_number as string) ?? null,
        ifsc: (s.bank_ifsc as string) ?? null,
        email: (s.email as string) ?? null,
      };
    }
  }

  const narration = `Salary ${MONTHS[run.pay_period_month]} ${run.pay_period_year}`;
  const missing: string[] = [];
  const bankRows: BankRow[] = [];
  for (const slip of slips ?? []) {
    const b = slip.staff_id ? bankByStaff[slip.staff_id as string] : undefined;
    const amount = Number(slip.net_salary) || 0;
    if (!b || !b.account || !b.ifsc || amount <= 0) {
      missing.push(b?.name ?? (slip.staff_id as string) ?? 'unknown');
      continue;
    }
    bankRows.push({ name: b.name ?? '', account: b.account, ifsc: b.ifsc, amount, email: b.email, narration });
  }

  if (missing.length && !skipIncomplete) {
    return NextResponse.json({
      error: 'Some staff are missing bank details (account number / IFSC) or have zero net pay. Add their bank details, or pass skip_incomplete=1 to exclude them from this file.',
      missing_count: missing.length,
      missing,
    }, { status: 422 });
  }

  const lines = [csvRow(cfg.header), ...bankRows.map((r) => csvRow(cfg.row(r)))];
  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${cfg.filename}"`,
      'X-Bank-Rows': String(bankRows.length),
      'X-Skipped-Count': String(missing.length),
    },
  });
}
