// app/api/parent/vidya-grid/subscribe/route.ts
// VG-3 (parent top-up) — a parent buys a paid Vidya Grid subscription for THEIR
// OWN child (parent session -> student_id), even on a free-tier school.
//
// Two steps in one route (mirrors the parent fee Razorpay flow):
//   action='create_order' -> validate plan, gate on consent + VG enabled, create
//                            a Razorpay order, return {order_id, amount, key_id}.
//   action='confirm'      -> verify the Razorpay signature, re-check consent,
//                            insert a student_vidya_grid_subscriptions row.
//
// Guardrails: own-child only (session.studentId — never a body-supplied id);
// consent-gated (adaptive_learning_ai); platform Razorpay keys from env only
// (never feature_flags, never client); signature verified before any write;
// idempotent (payment_ref unique index). Pricing is server-set (never trusted
// from the client).

import { NextRequest, NextResponse } from 'next/server';
import { getParentSession } from '@/lib/parent-auth';
import { verifyRazorpaySignature } from '@/lib/razorpay-verify';
import { getVidyaGridEntitlement, computePaidUntil, type VgTopupPlan } from '@/lib/vidya-grid-entitlement';
import { hasAdaptiveLearningConsent } from '@/lib/vidya-grid-consent';
import { supabaseAdmin } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

// Server-set pricing (paise). LOCKED: ₹99/mo, ₹799/yr.
const PRICE_PAISE: Record<VgTopupPlan, number> = { monthly: 9900, yearly: 79900 };

export async function POST(req: NextRequest) {
  const session = await getParentSession(req);
  if (!session) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: {
    action?: string;
    plan?: VgTopupPlan;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const action = (body.action ?? '').trim();
  const plan = body.plan;
  if (plan !== undefined && plan !== 'monthly' && plan !== 'yearly') {
    return NextResponse.json({ error: "plan must be 'monthly' or 'yearly'" }, { status: 400 });
  }

  const { parentId, schoolId, studentId } = session;

  // VG must be enabled for the school (free or paid) for a top-up to apply.
  const ent = await getVidyaGridEntitlement(schoolId);
  if (ent.plan === 'none') {
    return NextResponse.json({ error: 'Vidya Grid is not enabled for your school.', code: 'VG_NOT_ENABLED' }, { status: 403 });
  }

  // Consent gate (DPDP) — required for both steps.
  const consentOk = await hasAdaptiveLearningConsent(parentId, schoolId);
  if (!consentOk) {
    return NextResponse.json({ error: 'Consent required before upgrading.', code: 'CONSENT_REQUIRED' }, { status: 403 });
  }

  const keyId = process.env.RAZORPAY_PLATFORM_KEY_ID;
  const keySecret = process.env.RAZORPAY_PLATFORM_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('[vg-subscribe] Razorpay platform keys not configured');
    return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 });
  }

  // ── Step 1: create order ────────────────────────────────────────────────────
  if (action === 'create_order') {
    if (!plan) return NextResponse.json({ error: 'plan required' }, { status: 400 });
    const amount = PRICE_PAISE[plan];
    const authHeader = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    try {
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt: `vg_${studentId}_${Date.now()}`,
          notes: { kind: 'vg_topup', plan, student_id: studentId, school_id: schoolId },
        }),
      });
      if (!rzpRes.ok) {
        const err = await rzpRes.json().catch(() => ({}));
        console.error('[vg-subscribe] Razorpay order error:', rzpRes.status, err);
        return NextResponse.json({ error: 'Payment order creation failed' }, { status: 502 });
      }
      const order = await rzpRes.json() as { id: string; amount: number; currency: string };
      return NextResponse.json({ order_id: order.id, amount_paise: order.amount, currency: order.currency, key_id: keyId, plan });
    } catch (e) {
      console.error('[vg-subscribe] Razorpay fetch failed:', e);
      return NextResponse.json({ error: 'Payment service unavailable' }, { status: 503 });
    }
  }

  // ── Step 2: confirm ─────────────────────────────────────────────────────────
  if (action === 'confirm') {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (!plan || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'plan, razorpay_order_id, razorpay_payment_id, razorpay_signature required' }, { status: 400 });
    }
    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret)) {
      console.warn('[vg-subscribe] signature mismatch for student', studentId);
      return NextResponse.json({ error: 'Payment signature invalid' }, { status: 400 });
    }

    const paidUntil = computePaidUntil(plan, new Date());
    const { error: insErr } = await supabaseAdmin.from('student_vidya_grid_subscriptions').insert({
      student_id: studentId,
      school_id: schoolId,
      plan: 'paid',
      paid_until: paidUntil,
      source: 'parent',
      payment_ref: razorpay_payment_id,
    });

    // Idempotent: a duplicate payment_ref (23505 unique violation) = already recorded.
    if (insErr && (insErr as { code?: string }).code === '23505') {
      return NextResponse.json({ success: true, already_recorded: true, paid_until: paidUntil });
    }
    if (insErr) {
      console.error('[vg-subscribe] insert failed:', insErr.message);
      return NextResponse.json({ error: 'Could not record subscription. Please contact support.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, paid_until: paidUntil });
  }

  return NextResponse.json({ error: "action must be 'create_order' or 'confirm'" }, { status: 400 });
}
