// app/api/admin/fees/[id]/installment-plan/route.ts
// Batch 9 — Create/fetch installment plan for a fee.
// fee_installment_plans + fee_installments tables already exist (confirmed schema-first).
// fees.status 'partial' already valid.
// Auth: requireAdminSession (accountant in ALLOWED_ROLES).
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function ctx(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return null; throw e; }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await ctx(req);
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = session;
  const { id: feeId } = await params;

  const { data: plan } = await supabaseAdmin
    .from('fee_installment_plans')
    .select('id, fee_id, total_amount, installment_count, frequency, created_at')
    .eq('fee_id', feeId).eq('school_id', schoolId).maybeSingle();
  if (!plan) return NextResponse.json({ plan: null, installments: [] });

  const { data: installments } = await supabaseAdmin
    .from('fee_installments')
    .select('id, installment_number, amount, due_date, status, paid_date, payment_method')
    .eq('plan_id', plan.id).eq('school_id', schoolId)
    .order('installment_number');

  return NextResponse.json({ plan, installments: installments ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await ctx(req);
  if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = session;
  const { id: feeId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { installment_count, frequency, custom_due_dates } = body as {
    installment_count?: number; frequency?: string; custom_due_dates?: string[];
  };

  if (!installment_count || installment_count < 2 || installment_count > 12)
    return NextResponse.json({ error: 'installment_count must be 2–12' }, { status: 400 });
  if (!frequency || !['monthly','quarterly','custom'].includes(frequency))
    return NextResponse.json({ error: 'frequency must be monthly, quarterly, or custom' }, { status: 400 });
  if (frequency === 'custom' && (!custom_due_dates || custom_due_dates.length !== installment_count))
    return NextResponse.json({ error: `custom_due_dates must have exactly ${installment_count} dates` }, { status: 400 });

  // Fetch fee
  const { data: fee } = await supabaseAdmin
    .from('fees')
    .select('id, amount, status, student_id')
    .eq('id', feeId).eq('school_id', schoolId).maybeSingle();
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  if (!['pending','overdue'].includes(fee.status as string))
    return NextResponse.json({ error: `Fee status '${fee.status}' cannot be converted to installments. Only pending or overdue fees.` }, { status: 400 });

  // Check no existing plan
  const { data: existing } = await supabaseAdmin
    .from('fee_installment_plans').select('id').eq('fee_id', feeId).eq('school_id', schoolId).maybeSingle();
  if (existing) return NextResponse.json({ error: 'Installment plan already exists for this fee' }, { status: 400 });

  const totalAmount = Number(fee.amount);
  const baseAmount = Math.floor((totalAmount / installment_count) * 100) / 100;
  const lastAmount = parseFloat((totalAmount - baseAmount * (installment_count - 1)).toFixed(2));

  // Calculate due dates
  const today = new Date();
  const dueDates: string[] = [];
  if (frequency === 'custom') {
    dueDates.push(...(custom_due_dates as string[]));
  } else {
    const intervalDays = frequency === 'monthly' ? 30 : 90;
    for (let i = 1; i <= installment_count; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + intervalDays * i);
      dueDates.push(d.toISOString().slice(0, 10));
    }
  }

  // Create plan
  const { data: plan, error: planErr } = await supabaseAdmin
    .from('fee_installment_plans')
    .insert({ school_id: schoolId, fee_id: feeId, total_amount: totalAmount, installment_count, frequency })
    .select().single();
  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 });

  // Create installments
  const installmentRows = Array.from({ length: installment_count }, (_, i) => ({
    school_id: schoolId,
    plan_id: plan.id,
    fee_id: feeId,
    student_id: fee.student_id,
    installment_number: i + 1,
    amount: i === installment_count - 1 ? lastAmount : baseAmount,
    due_date: dueDates[i],
    status: 'pending',
  }));

  const { error: insErr } = await supabaseAdmin.from('fee_installments').insert(installmentRows);
  if (insErr) {
    await supabaseAdmin.from('fee_installment_plans').delete().eq('id', plan.id);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  // Update fee to partial
  await supabaseAdmin.from('fees').update({ status: 'partial' }).eq('id', feeId).eq('school_id', schoolId);

  return NextResponse.json({ plan_id: plan.id, installments: installmentRows.map((r, i) => ({ number: i + 1, amount: r.amount, due_date: r.due_date })) }, { status: 201 });
}
