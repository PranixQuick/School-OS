// app/api/auth/otp/request/route.ts
// ISS-OTP PR3 (spec §6.3) — request an OTP.
//
// SMS-cost protection (api_rate_log is API-key-shaped, not phone/IP, so we use
// schema-fit layers instead):
//   1. Existence gate — only DISPATCH to MSG91 when the phone maps to a real
//      account (parents/students/staff/vendors). Kills random-number wallet drain.
//   2. Per-phone DB cap — count phone_otp rows in a 15-min window.
//   3. In-memory per-IP burst guard (best-effort, per instance).
// Responses are ALWAYS generic — existence is never revealed.
// Fail-safe: 503 OTP_DISABLED when the flag/keys are absent so callers fall back.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import { requestOtp, isOtpEnabled, maskPhone, type OtpPurpose } from '@/lib/otp';
import { normalisePhone } from '@/lib/whatsapp';
import { clientIpFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

const PURPOSES = new Set<OtpPurpose>(['activation', 'reset', 'login']);
const PHONE_WINDOW_MS = 15 * 60 * 1000;
const PHONE_MAX = 3;          // sends per phone per window
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX = 15;            // requests per IP per window (burst guard)

const ipHits = new Map<string, { count: number; firstAt: number }>();
function ipAllowed(ip: string | null): boolean {
  if (!ip) return true;
  const now = Date.now();
  const w = ipHits.get(ip);
  if (!w || now - w.firstAt >= IP_WINDOW_MS) { ipHits.set(ip, { count: 1, firstAt: now }); return true; }
  w.count += 1;
  return w.count <= IP_MAX;
}

async function phoneHasAccount(variants: string[]): Promise<{ exists: boolean; schoolId: string | null }> {
  const [p, s, st, v] = await Promise.all([
    supabaseAdmin.from('parents').select('school_id').in('phone', variants).eq('is_active', true).limit(1),
    supabaseAdmin.from('students').select('school_id').in('phone_parent', variants).eq('is_active', true).limit(1),
    supabaseAdmin.from('staff').select('school_id').in('phone', variants).eq('is_active', true).limit(1),
    supabaseAdmin.from('vendors').select('school_id').in('contact_phone', variants).eq('is_active', true).limit(1),
  ]);
  for (const r of [p, s, st, v]) {
    const row = r.data?.[0] as { school_id?: string } | undefined;
    if (row) return { exists: true, schoolId: row.school_id ?? null };
  }
  return { exists: false, schoolId: null };
}

export async function POST(req: NextRequest) {
  if (!isOtpEnabled()) {
    return NextResponse.json({ error: 'OTP is not enabled.', code: 'OTP_DISABLED' }, { status: 503 });
  }

  let body: { phone?: string; purpose?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const rawPhone = (body.phone ?? '').trim();
  const purpose = (body.purpose ?? '').trim() as OtpPurpose;
  if (!rawPhone || !PURPOSES.has(purpose)) {
    return NextResponse.json({ error: 'phone and a valid purpose are required' }, { status: 400 });
  }

  const phone = normalisePhone(rawPhone) ?? rawPhone;
  const ip = clientIpFromRequest(req);

  // Generic response used for every non-error outcome (no existence disclosure).
  const generic = NextResponse.json({ success: true, message: 'If this number is registered, an OTP has been sent.' });

  // (3) per-IP burst guard
  if (!ipAllowed(ip)) return generic;

  // (2) per-phone cap within the window
  const since = new Date(Date.now() - PHONE_WINDOW_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('phone_otp')
    .select('id', { count: 'exact', head: true })
    .eq('phone', phone)
    .gte('created_at', since);
  if ((count ?? 0) >= PHONE_MAX) return generic;

  // (1) existence gate — only dispatch SMS for a known account
  const variants = Array.from(new Set([phone, rawPhone]));
  const { exists, schoolId } = await phoneHasAccount(variants);
  if (exists) {
    await requestOtp({ phone, purpose, schoolId });
  } else {
    console.warn('[otp/request] no account for', maskPhone(phone), '— skipping send');
  }

  return generic;
}
