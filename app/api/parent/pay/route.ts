import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getParentSession } from '@/lib/parent-auth';

// POST /api/parent/pay   body: { fee_id: string }
// Access-gated: requires a valid PARENT SESSION, and the fee must belong to that
// parent's own child (school_id + student_id). Creates a Razorpay order server-side
// (keys never reach the client) and writes the optimistic 'created' ledger row.
// Capture -> reconcile is handled by the payments-webhook function.
export async function POST(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { fee_id?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const feeId = body.fee_id;
  if (!feeId) return NextResponse.json({ error: 'fee_id required' }, { status: 400 });

  // server-side amount of record, scoped to THIS parent's child (never trust client)
  const { data: fee, error } = await supabaseAdmin
    .from('fees')
    .select('id, amount, amount_paid_minor, student_id, school_id, status')
    .eq('id', feeId)
    .eq('school_id', session.schoolId)
    .eq('student_id', session.studentId)
    .single();

  if (error || !fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  if (['paid', 'refunded'].includes(fee.status)) return NextResponse.json({ error: 'Not collectable' }, { status: 409 });

  const dueMinor = Math.round(Number(fee.amount) * 100) - (fee.amount_paid_minor ?? 0);
  if (dueMinor <= 0) return NextResponse.json({ error: 'Nothing due' }, { status: 409 });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return NextResponse.json({ error: 'Payments not configured' }, { status: 503 });

  // gateway-hosted checkout -> PCI SAQ-A; no card data touches us
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: JSON.stringify({
      amount: dueMinor,
      currency: 'INR',
      receipt: `fee_${feeId}`,
      notes: { fee_id: feeId, school_id: session.schoolId, student_id: session.studentId },
    }),
  });
  if (!r.ok) return NextResponse.json({ error: 'Gateway order failed' }, { status: 502 });
  const order = await r.json();

  // optimistic 'created' row in the immutable ledger (captured row appended by webhook)
  await supabaseAdmin.from('payment_transactions').insert({
    school_id: session.schoolId,
    student_id: session.studentId,
    fee_id: feeId,
    gateway: 'razorpay',
    gateway_order_id: order.id,
    amount_minor: dueMinor,
    currency: 'INR',
    status: 'created',
  });

  return NextResponse.json({ order_id: order.id, amount: dueMinor, key_id: keyId, currency: 'INR' });
}
