// app/api/parent/fees/confirm-payment/route.ts
// Item #13 PR #2 — Hybrid Fee Collection: Mode A Razorpay signature verification.
//
// POST /api/parent/fees/confirm-payment
//
// Auth: phone+PIN per request
// Called by frontend AFTER Razorpay checkout modal closes with success.
//
// Body: {
//   phone, pin
//   razorpay_order_id: string
//   razorpay_payment_id: string
//   razorpay_signature: string   — hmac_sha256(order_id + "|" + payment_id, KEY_SECRET)
//   fee_id: string (uuid)
// }
//
// On valid signature: marks fee paid, stores payment_id as receipt.
// Idempotent: returns 200 if fee already paid (safe to retry).
//
// TODO(item-15): migrate to supabaseForUser when parent auth moves to session model.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';
import { isFeeModuleEnabled } from '@/lib/institution-flags';

export const runtime = 'nodejs';

interface ConfirmBody {
  phone: string;
  pin: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  fee_id: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidBody(b: unknown): b is ConfirmBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.phone === 'string' && typeof o.pin === 'string' &&
    typeof o.razorpay_order_id === 'string' &&
    typeof o.razorpay_payment_id === 'string' &&
    typeof o.razorpay_signature === 'string' &&
    isUuid(o.fee_id)
  );
}

function todayIST(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: 'Body must include phone, pin, razorpay_order_id, razorpay_payment_id, razorpay_signature, fee_id' },
      { status: 400 }
    );
  }

  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET;
  if (!keySecret) {
    console.error('[confirm-payment] RAZORPAY_PLATFORM_KEY_SECRET not configured');
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
  }

  // Verify Razorpay signature FIRST — before any DB work
  const expectedSig = createHmac('sha256', keySecret)
    .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
    .digest('hex');

  if (expectedSig !== body.razorpay_signature) {
    console.warn('[confirm-payment] signature mismatch for fee', body.fee_id);
    return NextResponse.json({ error: 'Payment signature invalid' }, { status: 400 });
  }

  // Re-auth parent
  const { data: parents, error: pErr } = await supabaseAdmin
    .from('parents')
    .select('id, school_id, student_id')
    .eq('phone', body.phone)
    .eq('access_pin', body.pin);

  if (pErr) return NextResponse.json({ error: 'Credential verification failed' }, { status: 500 });
  if (!parents || parents.length === 0) return NextResponse.json({ error: 'Invalid phone or PIN' }, { status: 401 });
  if (parents.length > 1) return NextResponse.json({ error: 'Multiple accounts match this phone.' }, { status: 409 });

  const parent = parents[0];
  const { school_id: schoolId, student_id: studentId } = parent;

  // Institution gate
  const feeEnabled = await isFeeModuleEnabled(schoolId);
  if (!feeEnabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });

  // Fetch fee
  const { data: fee, error: feeErr } = await supabaseAdmin
    .from('fees')
    .select('id, status, student_id')
    .eq('id', body.fee_id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (feeErr) return NextResponse.json({ error: feeErr.message }, { status: 500 });
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  if (fee.student_id !== studentId) return NextResponse.json({ error: 'Fee does not belong to your student' }, { status: 403 });

  // Idempotent — if already paid (e.g. webhook arrived first) return success
  if (fee.status === 'paid') {
    return NextResponse.json({ success: true, receipt_number: body.razorpay_payment_id, already_paid: true });
  }

  const { data, error: updateErr } = await supabaseAdmin
    .from('fees')
    .update({
      status: 'paid',
      payment_method: 'online',
      payment_reference: body.razorpay_payment_id,
      fee_receipt_number: body.razorpay_payment_id,
      paid_date: todayIST(),
      payment_verified_at: new Date().toISOString(),
    })
    .eq('id', body.fee_id)
    .eq('school_id', schoolId)
    .select('id, status, fee_receipt_number')
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ success: true, receipt_number: data.fee_receipt_number });
}
