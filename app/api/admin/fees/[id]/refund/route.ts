// app/api/admin/fees/[id]/refund/route.ts
// Batch 8 — Initiate Razorpay refund for a paid online fee.
// Auth: requireAdminSession (accountant role already in ALLOWED_ROLES).
// Guards: paid + online + no prior refund.
// TODO(item-15): migrate to supabaseForUser

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdminSession, AdminAuthError } from '@/lib/admin-auth';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

async function resolveSession(req: NextRequest) {
  try { return await requireAdminSession(req); }
  catch (e) { if (e instanceof AdminAuthError) return null; throw e; }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await resolveSession(req);
  if (!ctx) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { schoolId } = ctx;
  const { id: feeId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { amount, reason } = body as { amount?: number; reason?: string };
  if (!amount || !reason) return NextResponse.json({ error: 'amount and reason are required' }, { status: 400 });

  // Fetch fee
  const { data: fee } = await supabaseAdmin
    .from('fees')
    .select('id, school_id, amount, status, payment_method, payment_reference, refund_status, student_id, fee_type, students(name)')
    .eq('id', feeId)
    .eq('school_id', schoolId)
    .maybeSingle();
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });

  // Guards
  if (fee.payment_method !== 'online')
    return NextResponse.json({ error: 'Only online payments can be refunded. For cash/cheque use manual adjustment.' }, { status: 400 });
  if (fee.status !== 'paid')
    return NextResponse.json({ error: 'Only paid fees can be refunded' }, { status: 400 });
  if ((fee.refund_status ?? 'none') !== 'none')
    return NextResponse.json({ error: `Refund already ${fee.refund_status}` }, { status: 400 });
  if (amount > Number(fee.amount))
    return NextResponse.json({ error: 'Refund amount cannot exceed fee amount' }, { status: 400 });
  if (!fee.payment_reference)
    return NextResponse.json({ error: 'No Razorpay payment reference found for this fee' }, { status: 400 });

  // Razorpay refund
  const rzpKeyId = process.env.RAZORPAY_KEY_ID;
  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!rzpKeyId || !rzpKeySecret)
    return NextResponse.json({ error: 'Razorpay credentials not configured' }, { status: 503 });

  const credentials = Buffer.from(`${rzpKeyId}:${rzpKeySecret}`).toString('base64');

  let refundResult: { id: string; status: string } | null = null;
  let rzpError: string | null = null;

  try {
    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${fee.payment_reference}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // paise
          speed: 'normal',
          notes: { reason, fee_id: feeId },
        }),
      }
    );
    const rzpData = await rzpRes.json() as { id?: string; status?: string; error?: { description?: string } };
    if (!rzpRes.ok) {
      rzpError = rzpData.error?.description ?? `Razorpay error: ${rzpRes.status}`;
    } else {
      refundResult = { id: rzpData.id ?? '', status: rzpData.status ?? 'created' };
    }
  } catch (e) {
    rzpError = `Network error: ${String(e)}`;
  }

  if (rzpError) {
    await supabaseAdmin.from('fees').update({ refund_status: 'failed' })
      .eq('id', feeId).eq('school_id', schoolId);
    return NextResponse.json({ error: rzpError }, { status: 502 });
  }

  // Update fee
  await supabaseAdmin.from('fees').update({
    refund_amount: amount,
    refund_status: 'processing',
    refund_at: new Date().toISOString(),
    razorpay_refund_id: refundResult!.id,
  }).eq('id', feeId).eq('school_id', schoolId);

  // Notification (best-effort)
  const studentName = Array.isArray(fee.students) ? fee.students[0]?.name : (fee.students as { name: string } | null)?.name ?? 'student';
  try {
    await supabaseAdmin.from('notifications').insert({
      school_id: schoolId,
      student_id: fee.student_id,
      type: 'broadcast',
      module: 'fees',
      title: `Refund initiated for ${studentName}`,
      message: `Refund of ₹${amount.toLocaleString('en-IN')} initiated for ${fee.fee_type ?? 'fee'}. Estimated 5-7 business days.`,
      status: 'dispatched',
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({ success: true, refund_id: refundResult!.id, status: 'processing' });
}
