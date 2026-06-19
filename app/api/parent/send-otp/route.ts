// app/api/parent/send-otp/route.ts
// ISS-OTP PR5 (parents) — send an activation OTP for parent self-registration.
//
// REPLACES the previous WhatsApp flow that stored the raw OTP in
// parents.access_pin (PIN-clobber risk). Now delegates to the shared OTP service:
//   * existence gate: only dispatch when the phone matches an active student's
//     phone_parent (a parent-to-be) — protects the MSG91 wallet;
//   * per-phone rate-limit (phone_otp rows in a 15-min window);
//   * code stored bcrypt-hashed in phone_otp, sent via MSG91 (PR2/PR3).
// Generic success (no enumeration). Fail-safe 503 when OTP_ENABLED is off.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requestOtp, isOtpEnabled, maskPhone } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_PHONE = 3;

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json(
      { error: 'OTP registration is unavailable right now. Please contact your school admin for your PIN.', code: 'OTP_DISABLED' },
      { status: 503 },
    );
  }

  let body: { phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const rawPhone = (body.phone ?? '').trim();
  if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;
  const variants = Array.from(new Set([phone, rawPhone]));

  // Existence gate — phone must belong to an active student's parent.
  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, school_id')
    .or(variants.map((v) => `phone_parent.eq.${v}`).join(','))
    .eq('is_active', true)
    .limit(1);

  // Per-phone rate-limit (cost cap on a known number).
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('phone_otp')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', since);

  if (students && students.length > 0 && (count ?? 0) < MAX_PER_PHONE) {
    await requestOtp({ phone, purpose: 'activation', schoolId: students[0].school_id ?? null });
  } else if (!students || students.length === 0) {
    console.warn('[parent/send-otp] no student for', maskPhone(phone), '— skipping send');
  }

  // Generic — never reveal whether the number is registered.
  return NextResponse.json({ success: true, message: 'If this number is registered, an OTP has been sent.' });
}
