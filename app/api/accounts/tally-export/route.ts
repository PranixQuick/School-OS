// app/api/accounts/tally-export/route.ts
// ISS-10 (#10b) — Tally export of fee collections.
//
// GET /api/accounts/tally-export?format=xml|csv&from=YYYY-MM-DD&to=YYYY-MM-DD
//   - Exports PAID fees (receipt vouchers) in the given paid_date range.
//   - format=xml -> Tally native voucher import (Gateway > Import > Vouchers).
//   - format=csv -> one row per collection for review / manual keying.
//   - Ledger mapping: income ledger = fee type (title-cased); the cash/bank
//     contra ledger is chosen by payment method (cash -> Cash, else Bank).
//
// Auth: requireAdminSession. Accountant is permitted because the path is under
// /api/accounts (ACCOUNTANT_ROUTE_ALLOWLIST). Read-only; no writes, no schema change.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { isFeeModuleEnabled } from '@/lib/institution-flags';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

interface Student { name?: string; class?: string; section?: string }
interface FeeRow {
  id: string;
  amount: number;
  paid_date: string | null;
  fee_type: string;
  description?: string | null;
  payment_method?: string | null;
  payment_reference?: string | null;
  fee_receipt_number?: string | null;
  students?: Student | Student[] | null;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function titleCase(s: unknown): string {
  return String(s ?? '').replace(/[_-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
function cashLedger(method: string | null | undefined): string {
  return (method ?? '').toLowerCase() === 'cash' ? 'Cash' : 'Bank';
}
function tallyDate(d: string | null): string {
  return (d ?? '').slice(0, 10).replace(/-/g, '');
}
function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function one(v: Student | Student[] | null | undefined): Student | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const format = (sp.get('format') ?? 'csv').toLowerCase();
  const from = sp.get('from');
  const to = sp.get('to');

  let q = supabaseAdmin
    .from('fees')
    .select('id, amount, paid_date, fee_type, description, payment_method, payment_reference, fee_receipt_number, students:student_id ( name, class, section )')
    .eq('school_id', schoolId)
    .eq('status', 'paid')
    .order('paid_date', { ascending: true });
  if (from) q = q.gte('paid_date', from);
  if (to) q = q.lte('paid_date', to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Only collections with an actual payment date can become a dated voucher.
  const rows = ((data ?? []) as FeeRow[]).filter((f) => f.paid_date);

  const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).maybeSingle();
  const company = (school?.name as string | null) ?? 'School';

  const rangeTag = `${from ?? 'all'}_${to ?? 'all'}`;

  if (format === 'xml') {
    const vouchers = rows.map((f) => {
      const s = one(f.students);
      const amt = Number(f.amount || 0).toFixed(2);
      const income = titleCase(f.fee_type) || 'Fee Collection';
      const cash = cashLedger(f.payment_method);
      const vno = f.fee_receipt_number || f.id;
      const date = tallyDate(f.paid_date);
      const clsTxt = s?.class ? ` (Class ${s.class}${s?.section ? '-' + s.section : ''})` : '';
      const refTxt = f.payment_reference ? ` Ref: ${f.payment_reference}` : '';
      const narr = `${titleCase(f.fee_type)} fee — ${s?.name ?? ''}${clsTxt}${refTxt}`;
      return `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
     <DATE>${date}</DATE>
     <NARRATION>${esc(narr)}</NARRATION>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${esc(vno)}</VOUCHERNUMBER>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${esc(cash)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>-${amt}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${esc(income)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>${amt}</AMOUNT>
     </ALLLEDGERENTRIES.LIST>
    </VOUCHER>
   </TALLYMESSAGE>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
 <HEADER>
  <TALLYREQUEST>Import Data</TALLYREQUEST>
 </HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC>
    <REPORTNAME>Vouchers</REPORTNAME>
    <STATICVARIABLES>
     <SVCURRENTCOMPANY>${esc(company)}</SVCURRENTCOMPANY>
    </STATICVARIABLES>
   </REQUESTDESC>
   <REQUESTDATA>
${vouchers}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="tally-receipts-${rangeTag}.xml"`,
      },
    });
  }

  // CSV (default)
  const header = ['Date', 'Voucher No', 'Voucher Type', 'Student', 'Class', 'Fee Type', 'Income Ledger', 'Cash/Bank Ledger', 'Amount', 'Payment Mode', 'Reference'];
  const lines = [header.join(',')];
  for (const f of rows) {
    const s = one(f.students);
    const cls = [s?.class, s?.section].filter(Boolean).join('-');
    lines.push([
      (f.paid_date ?? '').slice(0, 10),
      f.fee_receipt_number || f.id,
      'Receipt',
      s?.name ?? '',
      cls,
      titleCase(f.fee_type),
      titleCase(f.fee_type) || 'Fee Collection',
      cashLedger(f.payment_method),
      Number(f.amount || 0).toFixed(2),
      f.payment_method ?? '',
      f.payment_reference ?? '',
    ].map(csvCell).join(','));
  }
  const csv = lines.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tally-receipts-${rangeTag}.csv"`,
    },
  });
}
