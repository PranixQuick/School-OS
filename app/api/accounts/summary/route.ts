// app/api/accounts/summary/route.ts
// Item #12 — Accounts Dashboard
//
// GET /api/accounts/summary
//
// Auth: requireAdminSession (accepts owner | principal | admin_staff | accountant)
// Returns financial summary for the school's fee records.
//
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function startOfMonthIST(): string {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-01`;
}

export async function GET(req: NextRequest) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { schoolId } = ctx;

  const today = todayIST();
  const monthStart = startOfMonthIST();

  // Fetch all fees for the school in parallel
  const [allFees, todayPaid] = await Promise.all([
    supabaseAdmin
      .from('fees')
      .select('id, status, amount, original_amount, fee_type, due_date, paid_date, payment_method, discount_amount')
      .eq('school_id', schoolId),
    supabaseAdmin
      .from('fees')
      .select('id, amount, payment_method')
      .eq('school_id', schoolId)
      .eq('status', 'paid')
      .eq('paid_date', today),
  ]);

  if (allFees.error) return NextResponse.json({ error: allFees.error.message }, { status: 500 });

  const fees = allFees.data ?? [];
  const todayFees = todayPaid.data ?? [];

  // ─── Today's collections ──────────────────────────────────────────────────
  const byMethod: Record<string, { amount: number; count: number }> = {
    cash: { amount: 0, count: 0 },
    online: { amount: 0, count: 0 },
    cheque: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 },
  };
  let todayTotal = 0;
  for (const f of todayFees) {
    const amt = Number(f.amount ?? 0);
    todayTotal += amt;
    const m = (f.payment_method ?? 'other').toLowerCase();
    const key = ['cash', 'online', 'cheque'].includes(m) ? m : 'other';
    byMethod[key].amount += amt;
    byMethod[key].count += 1;
  }

  // ─── This month ──────────────────────────────────────────────────────────
  let monthCollected = 0, monthPending = 0, monthOverdue = 0, monthWaived = 0;
  for (const f of fees) {
    const amt = Number(f.amount ?? 0);
    const paid = f.paid_date ?? '';
    const isThisMonth = paid >= monthStart && paid <= today;
    switch (f.status) {
      case 'paid':
        if (isThisMonth) monthCollected += amt;
        break;
      case 'pending':
        monthPending += amt;
        break;
      case 'overdue':
        monthOverdue += amt;
        break;
      case 'waived':
        monthWaived += amt;
        break;
    }
  }
  const monthExpected = monthCollected + monthPending + monthOverdue;

  // ─── By fee type ─────────────────────────────────────────────────────────
  const byTypeMap: Record<string, { collected: number; pending: number; overdue: number }> = {};
  for (const f of fees) {
    const t = f.fee_type ?? 'other';
    if (!byTypeMap[t]) byTypeMap[t] = { collected: 0, pending: 0, overdue: 0 };
    const amt = Number(f.amount ?? 0);
    if (f.status === 'paid') byTypeMap[t].collected += amt;
    else if (f.status === 'pending') byTypeMap[t].pending += amt;
    else if (f.status === 'overdue') byTypeMap[t].overdue += amt;
  }
  const byFeeType = Object.entries(byTypeMap).map(([fee_type, v]) => ({ fee_type, ...v }));

  // ─── Overdue breakdown ────────────────────────────────────────────────────
  const overdues = fees.filter(f => f.status === 'overdue');
  const overdueTotalAmt = overdues.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const oldestDueDate = overdues.length > 0
    ? overdues.map(f => f.due_date).sort()[0]
    : null;

  // ─── Pending verification ─────────────────────────────────────────────────
  const pendingVerification = fees.filter(f => f.status === 'pending_verification').length;

  return NextResponse.json({
    today_collections: {
      total_amount: todayTotal,
      count: todayFees.length,
      by_method: byMethod,
      date: today,
    },
    this_month: {
      collected: monthCollected,
      pending: monthPending,
      overdue: monthOverdue,
      waived: monthWaived,
      total_expected: monthExpected,
      month_start: monthStart,
    },
    by_fee_type: byFeeType,
    overdue_breakdown: {
      count: overdues.length,
      total_amount: overdueTotalAmt,
      oldest_due_date: oldestDueDate,
    },
    pending_verification: { count: pendingVerification },
    totals: {
      all_fees: fees.length,
      paid: fees.filter(f => f.status === 'paid').length,
      pending: fees.filter(f => f.status === 'pending').length,
      overdue: fees.filter(f => f.status === 'overdue').length,
    },
  });
}
