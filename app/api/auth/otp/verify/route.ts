// app/api/auth/otp/verify/route.ts
// ISS-OTP PR3 (spec §6.3) — verify an OTP.
//
// On success, returns a SHORT-LIVED proof-of-phone token (jose, 10 min, issuer
// 'edprosys-otp') carrying { phone, purpose, schoolId }. The next-step flows
// (set-PIN / reset / activation / passwordless login, wired in PR5+) verify this
// token before acting. We deliberately do NOT mint a stakeholder session here —
// which session to issue is decided per onboarding path later.
//
// Fail-safe: 503 OTP_DISABLED when the flag/keys are absent.

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { verifyOtp, isOtpEnabled, type OtpPurpose } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const PURPOSES = new Set<OtpPurpose>(['activation', 'reset', 'login']);
const TOKEN_TTL = '10m';

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP is not enabled.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { phone?: string; purpose?: string; code?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const rawPhone = (body.phone ?? '').trim();
  const purpose = (body.purpose ?? '').trim() as OtpPurpose;
  const code = (body.code ?? '').trim();
  if (!rawPhone || !PURPOSES.has(purpose) || !code) {
    return NextResponse.json({ error: 'phone, purpose and code are required' }, { status: 400 });
  }

  const phone = normalisePhone(rawPhone) ?? rawPhone;
  const result = await verifyOtp({ phone, purpose, code });

  if (!result.ok) {
    const msg =
      result.reason === 'expired' ? 'This code has expired. Please request a new one.'
      : result.reason === 'too_many_attempts' ? 'Too many attempts. Please request a new code.'
      : 'Invalid or expired code.';
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  // Short-lived proof of phone ownership for the next step.
  const secret = new TextEncoder().encode(env.SESSION_SECRET);
  const token = await new SignJWT({ phone, purpose, schoolId: result.schoolId ?? null })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('edprosys-otp')
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret);

  return NextResponse.json({ success: true, token, expires_in: 600 });
}
