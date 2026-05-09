// PATH: app/api/billing/webhook/route.ts
// Razorpay webhook — called after payment capture
// Verifies signature, updates school plan and usage_limits
//
// Auth model:
//   - Production requires RAZORPAY_WEBHOOK_SECRET to be set; the route returns 503
//     if it is missing so misconfiguration fails closed instead of silently
//     accepting forged payloads.
//   - Every request must carry a valid x-razorpay-signature HMAC of the raw
//     body. Missing or invalid signatures return 401.
//   - Local dev (NODE_ENV !== 'production') with no RAZORPAY_WEBHOOK_SECRET set
//     allows unauthenticated POSTs so that Razorpay test-mode replay tooling
//     works during development.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { createHmac } from 'crypto';

const PLAN_LIMITS: Record<string, {
  max_reports_per_month: number;
  max_evaluations_per_month: number;
  max_broadcasts_per_month: number;
  max_students: number;
  max_staff: number;
}> = {
  starter:    { max_reports_per_month: 100,  max_evaluations_per_month: 10,  max_broadcasts_per_month: 20,  max_students: 500,  max_staff: 30 },
  growth:     { max_reports_per_month: 500,  max_evaluations_per_month: 50,  max_broadcasts_per_month: 100, max_students: 2000, max_staff: 100 },
  campus:     { max_reports_per_month: 9999, max_evaluations_per_month: 999, max_broadcasts_per_month: 500, max_students: 99999, max_staff: 9999 },
  pro:        { max_reports_per_month: 200,  max_evaluations_per_month: 50,  max_broadcasts_per_month: 100, max_students: 1000, max_staff: 50 },
  enterprise: { max_reports_per_month: 9999, max_evaluations_per_month: 999, max_broadcasts_per_month: 500, max_students: 99999, max_staff: 9999 },
};

function verifyRazorpaySignature(body: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    return expected === signature;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const isProd = process.env.NODE_ENV === 'production';
    const rawBody = await req.text();

    // ── Auth gate ────────────────────────────────────────────────────────────
    // Production with no secret set → fail closed. Any caller could otherwise
    // forge a payment.captured payload and arbitrarily upgrade a school's plan.
    if (!webhookSecret) {
      if (isProd) {
        console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET not configured in production');
        return NextResponse.json({ error: 'webhook not configured' }, { status: 503 });
      }
      // Non-production with no secret: skip signature verification so local
      // replay tooling continues to work. Real webhooks never hit this branch
      // because production has the secret.
      console.warn('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET unset (non-production); accepting unsigned payload');
    } else {
      const signature = req.headers.get('x-razorpay-signature');
      if (!signature || !verifyRazorpaySignature(rawBody, signature, webhookSecret)) {
        console.error('[Razorpay Webhook] Invalid signature');
        return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
      }
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload: {
        payment?: { entity: { order_id: string; id: string; status: string; notes?: Record<string, string> } };
        order?: { entity: { id: string; status: string; notes?: Record<string, string> } };
      };
    };

    const eventType = event.event;
    console.log(`[Razorpay Webhook] Event: ${eventType}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const payment = event.payload.payment?.entity ?? event.payload.order?.entity;
      if (!payment) return NextResponse.json({ error: 'No payment entity in payload' }, { status: 400 });

      const orderId = 'order_id' in payment ? payment.order_id : payment.id;
      const notes = payment.notes ?? {};
      const schoolId = notes.school_id;
      const requestedPlan = notes.requested_plan;

      if (!schoolId || !requestedPlan) {
        console.error('[Razorpay Webhook] Missing school_id or requested_plan in notes');
        return NextResponse.json({ error: 'Missing order metadata' }, { status: 400 });
      }

      // Update school plan
      await supabaseAdmin.from('schools').update({
        plan: requestedPlan,
        updated_at: new Date().toISOString(),
      }).eq('id', schoolId);

      // Update usage limits
      const limits = PLAN_LIMITS[requestedPlan];
      if (limits) {
        await supabaseAdmin.from('usage_limits').update({
          plan: requestedPlan,
          ...limits,
        }).eq('school_id', schoolId);
      }

      // Mark upgrade request as completed
      await supabaseAdmin.from('upgrade_requests').update({
        status: 'completed',
        razorpay_order_id: orderId,
        updated_at: new Date().toISOString(),
      }).eq('school_id', schoolId).eq('requested_plan', requestedPlan).eq('status', 'pending');

      console.log(`[Razorpay Webhook] School ${schoolId} upgraded to ${requestedPlan}`);
      return NextResponse.json({ success: true, school_id: schoolId, plan: requestedPlan });
    }

    // For all other events, just acknowledge
    return NextResponse.json({ received: true, event: eventType });

  } catch (err) {
    console.error('[Razorpay Webhook] Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
