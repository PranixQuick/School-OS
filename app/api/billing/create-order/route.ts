// PATH: app/api/billing/create-order/route.ts
// Razorpay: create an order for school plan upgrade
// Frontend calls this → gets order_id → opens Razorpay checkout → payment captured → webhook confirms

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { getSchoolId } from '@/lib/getSchoolId';

const PLAN_PRICES: Record<string, { amount: number; name: string; currency: string }> = {
  starter: { amount: 499900,  name: 'School OS Starter',  currency: 'INR' }, // ₹4,999
  growth:  { amount: 1299900, name: 'School OS Growth',   currency: 'INR' }, // ₹12,999
  campus:  { amount: 2499900, name: 'School OS Campus',   currency: 'INR' }, // ₹24,999
  // Keep backward compat with old plan names
  pro:     { amount: 299900,  name: 'School OS Pro',      currency: 'INR' }, // ₹2,999 (legacy)
  enterprise: { amount: 799900, name: 'School OS Enterprise', currency: 'INR' }, // ₹7,999 (legacy)
};

export async function POST(req: NextRequest) {
  const schoolId = getSchoolId(req);
  try {
    const { plan } = await req.json() as { plan: string };

    const planMeta = PLAN_PRICES[plan];
    if (!planMeta) {
      return NextResponse.json({ error: `Unknown plan: ${plan}. Valid plans: ${Object.keys(PLAN_PRICES).join(', ')}` }, { status: 400 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json({
        error: 'Payment gateway not configured.',
        setup: ['Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to Vercel environment variables'],
      }, { status: 503 });
    }

    // Fetch school info
    const { data: school } = await supabaseAdmin.from('schools').select('name, plan').eq('id', schoolId).single();

    const receiptId = `school_${schoolId.slice(0, 8)}_${Date.now()}`;

    // Create Razorpay order
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: planMeta.amount,
        currency: planMeta.currency,
        receipt: receiptId,
        notes: {
          school_id: schoolId,
          school_name: school?.name ?? '',
          current_plan: school?.plan ?? '',
          requested_plan: plan,
        },
      }),
    });

    const order = await response.json() as { id?: string; error?: { description: string } };

    if (!response.ok) {
      return NextResponse.json({ error: `Razorpay error: ${order.error?.description ?? 'Unknown'}` }, { status: 502 });
    }

    // Store pending upgrade request
    await supabaseAdmin.from('upgrade_requests').insert({
      school_id: schoolId,
      current_plan: school?.plan ?? 'free',
      requested_plan: plan,
      razorpay_order_id: order.id,
      status: 'pending',
    }).catch(() => {}); // non-blocking

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: planMeta.amount,
      currency: planMeta.currency,
      plan_name: planMeta.name,
      key_id: keyId, // needed by Razorpay checkout JS
      prefill: {
        name: school?.name ?? '',
      },
    });

  } catch (err) {
    console.error('Create order error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
