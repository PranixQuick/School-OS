// app/api/parent/fees/create-order/route.ts
// Item #13 PR #2 — Hybrid Fee Collection: Mode A Razorpay order creation.
//
// POST /api/parent/fees/create-order
//
// Auth: phone+PIN per request
// Institution gate: fee_module_enabled + online_payment_enabled
//
// Secrets: RAZORPAY_PLATFORM_KEY_ID + RAZORPAY_PLATFORM_KEY_SECRET from process.env
// (Vercel env vars — never from feature_flags)
//
// Body: { phone, pin, fee_id }
//
// Flow:
//   1. Re-auth parent + validate fee belongs to parent's student
//   2. Check online_payment_enabled in feature_flags
//   3. POST to Razorpay /v1/orders with school_id + student_id in notes
//   4. Return {order_id, amount_paise, currency, key_id} for frontend checkout
//
// TODO(item-15): migrate to supabaseForUser when parent auth moves to session model.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// TODO(item-15): migrate to supabaseForUser
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getInstitutionFlags } from '@/lib/institution-flags';

export const runtime = 'nodejs';

interface CreateOrderBody {
  phone: string;
  pin: string;
  fee_id: string;
}

function isUuid(s: unknown): s is string {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function isValidBody(b: unknown): b is CreateOrderBody {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return typeof o.phone === 'string' && typeof o.pin === 'string' && isUuid(o.fee_id);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'Body must include phone, pin, fee_id (uuid)' }, { status: 400 });
  }

  // Env check early — fail fast if keys not configured
  const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID;
  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('[create-order] RAZORPAY_PLATFORM_KEY_ID or RAZORPAY_PLATFORM_KEY_SECRET not configured');
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
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

  // Institution gate — both fee_module_enabled AND online_payment_enabled
  const flags = await getInstitutionFlags(schoolId);
  if (!flags.fee_module_enabled) return NextResponse.json({ error: 'fee_module_disabled' }, { status: 403 });
  if (!flags.online_payment_enabled) return NextResponse.json({ error: 'online_payment_not_configured' }, { status: 403 });

  // Fetch fee
  const { data: fee, error: feeErr } = await supabaseAdmin
    .from('fees')
    .select('id, amount, student_id, status')
    .eq('id', body.fee_id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (feeErr) return NextResponse.json({ error: feeErr.message }, { status: 500 });
  if (!fee) return NextResponse.json({ error: 'Fee not found' }, { status: 404 });
  if (fee.student_id !== studentId) return NextResponse.json({ error: 'Fee does not belong to your student' }, { status: 403 });
  if (fee.status === 'paid' || fee.status === 'waived') {
    return NextResponse.json({ error: `Fee is already ${fee.status}` }, { status: 409 });
  }

  // Create Razorpay order
  const amountPaise = Math.round(Number(fee.amount) * 100);
  const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  let orderData: { id: string; amount: number; currency: string };
  try {
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: fee.id,
        notes: {
          fee_id: fee.id,
          student_id: studentId,
          school_id: schoolId,
        },
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.json().catch(() => ({}));
      console.error('[create-order] Razorpay error:', rzpRes.status, errBody);
      return NextResponse.json({ error: 'Payment order creation failed' }, { status: 502 });
    }

    orderData = await rzpRes.json();
  } catch (err) {
    console.error('[create-order] Razorpay fetch failed:', err);
    return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });
  }

  return NextResponse.json({
    order_id: orderData.id,
    amount_paise: orderData.amount,
    currency: orderData.currency,
    key_id: keyId, // public key only — secret never leaves server
  });
}
