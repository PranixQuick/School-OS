// app/api/admin/fees/installments/[installment_id]/route.ts
// Batch 9 — Mark an installment as paid. Auto-completes parent fee when all paid.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ installment_id: string }> }
) {
  let ctx;
  try { ctx = await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }
  const { schoolId } = ctx;
  const { installment_id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { status, payment_method, payment_reference, paid_date } = body as {
    status?: string; payment_method?: string;
    payment_reference?: string; paid_date?: string;
  };

  if (!status || !['paid','pending','overdue'].includes(status))
    return NextResponse.json({ error: 'status must be paid, pending, or overdue' }, { status: 400 });

  // Fetch installment + verify school ownership
  const { data: inst } = await supabaseAdmin
    .from('fee_installments')
    .select('id, fee_id, plan_id, status')
    .eq('id', installment_id)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!inst) return NextResponse.json({ error: 'Installment not found' }, { status: 404 });

  const update: Record<string, unknown> = { status };
  if (status === 'paid') {
    update.paid_date = paid_date ?? new Date().toISOString().slice(0, 10);
    if (payment_method) update.payment_method = payment_method;
    if (payment_reference) update.payment_reference = payment_reference;
  }

  const { data: updated, error } = await supabaseAdmin
    .from('fee_installments')
    .update(update)
    .eq('id', installment_id)
    .eq('school_id', schoolId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // If marked paid: check if all installments for this fee are now paid
  if (status === 'paid') {
    const { data: allInst } = await supabaseAdmin
      .from('fee_installments')
      .select('status')
      .eq('fee_id', inst.fee_id as string)
      .eq('school_id', schoolId);
    const allPaid = (allInst ?? []).every(i => i.status === 'paid');
    if (allPaid) {
      await supabaseAdmin.from('fees').update({
        status: 'paid',
        paid_date: new Date().toISOString().slice(0, 10),
      }).eq('id', inst.fee_id as string).eq('school_id', schoolId);
    }
  }

  return NextResponse.json({ installment: updated });
}
