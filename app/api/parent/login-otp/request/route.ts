// app/api/parent/login-otp/request/route.ts
// ISS-OTP PR6 (parents) — passwordless login: request a login OTP.
// Existence gate (parents.phone) + per-phone rate-limit; generic response.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requestOtp, isOtpEnabled, maskPhone } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';

export const runtime = 'nodejs';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_PHONE = 3;

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP sign-in is unavailable right now.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { phone?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const rawPhone = (body.phone ?? '').trim();
  if (!rawPhone) return NextResponse.json({ error: 'Phone number required' }, { status: 400 });

  const phone = normalisePhone(rawPhone) ?? rawPhone;
  const variants = Array.from(new Set([phone, rawPhone]));

  const generic = NextResponse.json({ success: true, message: 'If this number is registered, an OTP has been sent.' });

  const { data: parents } = await supabaseAdmin
    .from('parents').select('id, school_id').in('phone', variants).eq('is_active', true).limit(1);
  if (!parents || parents.length === 0) { console.warn('[parent/login-otp] no parent for', maskPhone(phone)); return generic; }

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('phone_otp').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', since);
  if ((count ?? 0) < MAX_PER_PHONE) {
    await requestOtp({ phone, purpose: 'login', schoolId: parents[0].school_id });
  }

  return generic;
}
