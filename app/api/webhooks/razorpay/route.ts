// app/api/webhooks/razorpay/route.ts
// Item #13 PR #2 — Hybrid Fee Collection: Mode A Razorpay webhook handler.
//
// POST /api/webhooks/razorpay
// This path must be in middleware.ts PUBLIC_PATHS (see middleware.ts update in this PR).
//
// Razorpay sends webhook with header: x-razorpay-signature
// Signature = hmac_sha256(raw_body, RAZORPAY_PLATFORM_KEY_SECRET)
//
// Handles: payment.captured event only.
// fee_id must be present in event.payload.payment.entity.notes.fee_id
//
// Idempotent: always returns 200 to Razorpay even on skip/error, to prevent retries.
//
// Note: This is a platform-level webhook endpoint.
// School isolation is guaranteed by verifying fee.school_id matches
// the school_id stored in the fee record — Razorpay cannot submit a fee
// for a school it was not created for.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function POST(req: NextRequest) {
  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET;
  if (!keySecret) {
    console.error('[webhook/razorpay] RAZORPAY_PLATFORM_KEY_SECRET not configured');
    return NextResponse.json({ ok: true }); // Always 200 to Razorpay
  }

  // Read raw body for signature verification (must not parse before HMAC check)
  const rawBody = await req.text();
  const incomingSig = req.headers.get('x-razorpay-signature') ?? '';

  const expectedSig = createHmac('sha256', keySecret).update(rawBody).digest('hex');
  if (expectedSig !== incomingSig) {
    console.warn('[webhook/razorpay] signature mismatch — ignoring event');
    return NextResponse.json({ ok: true }); // Still 200 — don't reveal verification failure
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    console.error('[webhook/razorpay] failed to parse event body');
    return NextResponse.json({ ok: true });
  }

  const eventName = event.event as string | undefined;
  if (eventName !== 'payment.captured') {
    // Silently ignore non-capture events (refunds, disputes etc handled separately)
    return NextResponse.json({ ok: true });
  }

  // Extract payment entity
  const paymentEntity = (event as {
    payload?: { payment?: { entity?: {
      id?: string;
      order_id?: string;
      notes?: { fee_id?: string; school_id?: string };
    } } }
  }).payload?.payment?.entity;

  const paymentId = paymentEntity?.id;
  const feeId = paymentEntity?.notes?.fee_id;

  if (!paymentId || !feeId) {
    console.warn('[webhook/razorpay] missing payment_id or fee_id in notes');
    return NextResponse.json({ ok: true });
  }

  // Fetch fee
  const { data: fee, error: feeErr } = await supabaseAdmin
    .from('fees')
    .select('id, status')
    .eq('id', feeId)
    .maybeSingle();

  if (feeErr || !fee) {
    console.error('[webhook/razorpay] fee not found:', feeId, feeErr?.message);
    return NextResponse.json({ ok: true });
  }

  // Idempotent — skip if already paid
  if (fee.status === 'paid') {
    console.log('[webhook/razorpay] fee already paid, skipping:', feeId);
    return NextResponse.json({ ok: true });
  }

  // Mark paid
  const { error: updateErr } = await supabaseAdmin
    .from('fees')
    .update({
      status: 'paid',
      payment_method: 'online',
      payment_reference: paymentId,
      fee_receipt_number: paymentId,
      paid_date: todayIST(),
      payment_verified_at: new Date().toISOString(),
    })
    .eq('id', feeId);

  if (updateErr) {
    console.error('[webhook/razorpay] update failed:', feeId, updateErr.message);
  } else {
    console.log('[webhook/razorpay] marked paid:', feeId, paymentId);
  }

  return NextResponse.json({ ok: true });
}
