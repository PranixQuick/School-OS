import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

export const runtime = 'nodejs';

interface PaymentLine { date: string | null; amount: number; mode: string; reference: string | null; }

// GET /api/parent/fees/receipt?fee_id=<uuid>
// Returns a receipt for a fee that belongs to THIS parent's child. Access-gated:
// requires a valid parent session AND the fee must match school_id + student_id.
//
// Real-world aware: institutions collect fees in full, in terms, or in part. The
// receipt therefore reports the full money picture — billed, owner concession,
// net payable, paid-to-date and balance due — plus the payment history (each
// part-payment). It is issued the moment ANY payment exists (paid >= 0), so a
// parent can download an acknowledgement for a partial payment, with the balance
// shown. Discount/amend is an owner/admin right; the parent view is read-only.
export async function GET(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const feeId = req.nextUrl.searchParams.get('fee_id');
  if (!feeId) return NextResponse.json({ error: 'fee_id required' }, { status: 400 });

  const { data: fee, error } = await supabaseAdmin
    .from('fees')
    .select('id, amount, original_amount, discount_amount, discount_reason, amount_paid_minor, gst_rate, tax_amount, fee_type, description, status, due_date, paid_date, fee_receipt_number, payment_method, payment_reference, student_id, school_id')
    .eq('id', feeId)
    .eq('school_id', session.schoolId)
    .eq('student_id', session.studentId)
    .single();

  if (error || !fee) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

  const net = Number(fee.amount) || 0;                                  // payable after concession
  const billed = Number(fee.original_amount ?? fee.amount) || 0;        // pre-concession
  const discount = Math.max(0, Number(fee.discount_amount) || 0);       // owner concession
  const paid = fee.amount_paid_minor != null
    ? Number(fee.amount_paid_minor) / 100
    : (fee.status === 'paid' ? net : 0);
  const balance = Math.max(0, Math.round((net - paid) * 100) / 100);
  const fullyPaid = paid > 0 && balance <= 0;

  if (paid <= 0) return NextResponse.json({ error: 'No payment has been recorded for this fee yet' }, { status: 409 });

  const [{ data: student }, { data: school }] = await Promise.all([
    supabaseAdmin.from('students')
      .select('name, class, section, roll_number, admission_number')
      .eq('id', fee.student_id).maybeSingle(),
    supabaseAdmin.from('schools')
      .select('name, address, board, contact_phone, website, tagline')
      .eq('id', fee.school_id).maybeSingle(),
  ]);

  // Payment history. Canonical source = allocations (money actually applied to this
  // fee) joined to their settled transaction. Falls back to the fee row itself for
  // offline/manual payments (cash/cheque recorded by the accountant), which have no
  // gateway transaction.
  const payments: PaymentLine[] = [];
  const { data: allocs } = await supabaseAdmin
    .from('payment_allocations')
    .select('amount_minor, created_at, transaction_id')
    .eq('fee_id', fee.id)
    .order('created_at', { ascending: true });

  if (allocs && allocs.length) {
    const txnIds = allocs.map(a => a.transaction_id).filter(Boolean);
    const { data: txns } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, method, gateway, gateway_payment_id, status, created_at')
      .in('id', txnIds);
    const byId = new Map((txns ?? []).map(t => [t.id, t]));
    for (const a of allocs) {
      const t = byId.get(a.transaction_id);
      if (t && !['captured', 'authorized', 'paid', 'success'].includes(t.status)) continue; // skip un-settled
      payments.push({
        date: (t?.created_at ?? a.created_at)?.slice(0, 10) ?? null,
        amount: Number(a.amount_minor) / 100,
        mode: t?.method || t?.gateway || 'Online',
        reference: t?.gateway_payment_id ?? null,
      });
    }
  }
  if (!payments.length) {
    payments.push({
      date: fee.paid_date ?? null,
      amount: paid,
      mode: fee.payment_method || 'Online',
      reference: fee.payment_reference ?? null,
    });
  }

  return NextResponse.json({
    receipt: {
      receipt_number: fee.fee_receipt_number ?? null,
      fully_paid: fullyPaid,
      student_name: student?.name ?? '',
      class: student?.class ?? '',
      section: student?.section ?? '',
      roll_number: student?.roll_number ?? '',
      admission_number: student?.admission_number ?? '',
      fee_type: fee.fee_type ?? '',
      description: fee.description ?? '',
      billed,
      discount,
      discount_reason: fee.discount_reason ?? null,
      net_payable: net,
      tax_amount: Number(fee.tax_amount) || 0,
      paid_amount: paid,
      balance_due: balance,
      latest_payment_date: payments[payments.length - 1]?.date ?? fee.paid_date ?? null,
      payment_mode: payments[payments.length - 1]?.mode ?? (fee.payment_method || 'Online'),
      payments,
      school_name: school?.name ?? 'EdProSys',
      school_address: school?.address ?? '',
      school_board: school?.board ?? '',
      school_phone: school?.contact_phone ?? '',
      school_website: school?.website ?? '',
      school_tagline: school?.tagline ?? '',
    },
  });
}
