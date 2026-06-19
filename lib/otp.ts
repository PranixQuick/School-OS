// lib/otp.ts
// EdProSys OTP build — PR2 (spec §2): shared OTP service, reused by ALL stakeholders.
// UNWIRED here: no endpoints/callers yet (those land in PR3+).
//
// Safety:
//   * OTP_ENABLED-gated and fail-safe — when the flag is off or MSG91 keys are
//     missing, requestOtp/verifyOtp report disabled so callers fall back to the
//     existing PIN/password (login must never hard-break).
//   * DPDP: store only bcrypt code_hash (never the raw code), 10-min TTL, attempt
//     cap, single-use; mask phone in any log line.
//
// vitest note: NO top-level `@/` imports (vitest has no `@/` alias). The
// supabaseClient dependency is lazy-imported inside the DB functions so the pure
// helpers below remain unit-testable.

import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

export type OtpPurpose = 'activation' | 'reset' | 'login';

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const CODE_LENGTH = 6;

/** Fail-safe gate: OTP only operates when explicitly enabled AND keys present. */
export function isOtpEnabled(): boolean {
  return (
    process.env.OTP_ENABLED === 'true' &&
    !!process.env.MSG91_AUTH_KEY &&
    !!process.env.MSG91_OTP_TEMPLATE_ID
  );
}

/** Cryptographically-random zero-padded 6-digit code. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(CODE_LENGTH, '0');
}

/** Mask a phone for logging — never log the full number. */
export function maskPhone(phone: string): string {
  const p = (phone ?? '').replace(/\s+/g, '');
  if (p.length <= 4) return '****';
  return p.slice(0, 2) + '****' + p.slice(-2);
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyCodeHash(code: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(code, hash);
}

/**
 * Send an OTP via MSG91 (DLT sender PRANIX + approved template).
 * Lazy/runtime-only; returns false on any failure (caller decides fallback).
 * Never logs the raw code; phone is masked.
 */
export async function sendViaMsg91(phone: string, code: string): Promise<boolean> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  const sender = process.env.MSG91_SENDER_ID || 'PRANIX';
  const base = (process.env.MSG91_BASE_URL || 'https://control.msg91.com').replace(/\/$/, '');
  if (!authKey || !templateId) return false;

  try {
    // MSG91 v5 OTP send. MSG91 reads these params from the QUERY STRING (the JSON
    // body is only for additional template variables), so template_id/mobile/otp/
    // sender must go in the URL or the ##OTP## placeholder is never filled. The
    // code is single-use with a 10-min TTL over server-to-server HTTPS; we never
    // log the URL and the phone is masked.
    // MSG91 expects the mobile in country-code form WITHOUT a leading '+'
    // (e.g. 919812345678). normalisePhone yields +91…, so strip the '+' here.
    const mobile = phone.replace(/^\+/, '');
    const url = `${base}/api/v5/otp`
      + `?template_id=${encodeURIComponent(templateId)}`
      + `&mobile=${encodeURIComponent(mobile)}`
      + `&otp=${encodeURIComponent(code)}`
      + `&sender=${encodeURIComponent(sender)}`
      + `&otp_expiry=10`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { authkey: authKey },
    });
    // MSG91 returns HTTP 200 even on logical errors; the JSON body carries
    // { type: 'success' | 'error', message }. Inspect the body, not just status.
    const bodyText = await res.text();
    let payload: { type?: string; message?: string } = {};
    try { payload = JSON.parse(bodyText); } catch { /* non-JSON response */ }

    // TEMP go-live diagnostic (remove after diagnosis): record the exact
    // template_id we sent and MSG91's full reply into otp_debug_log, since this
    // project's runtime logs don't surface console output. No raw OTP is stored.
    try {
      const { supabaseAdmin } = await import('@/lib/supabaseClient');
      await supabaseAdmin.from('otp_debug_log').insert({
        phone_masked: maskPhone(phone),
        template_id_sent: templateId,
        sender_sent: sender,
        http_status: res.status,
        response_body: (bodyText ?? '').slice(0, 1000),
      });
    } catch { /* diagnostic must never block the send */ }

    if (!res.ok || payload.type === 'error') {
      console.error('[otp] MSG91 send failed for', maskPhone(phone),
        '— http', res.status, '| type', payload.type ?? '?', '| msg', payload.message ?? '?');
      return false;
    }
    return true;
  } catch {
    console.error('[otp] MSG91 send error for', maskPhone(phone));
    return false;
  }
}

/**
 * Generate + store + send an OTP for a phone/purpose.
 * Invalidates any prior unconsumed code for the same (phone, purpose).
 * Returns { ok } (stored) and { sent } (delivered). Disabled => { ok:false }.
 */
export async function requestOtp(params: {
  phone: string;
  purpose: OtpPurpose;
  schoolId?: string | null;
}): Promise<{ ok: boolean; sent: boolean; disabled?: boolean }> {
  const { phone, purpose, schoolId = null } = params;
  if (!isOtpEnabled()) return { ok: false, sent: false, disabled: true };

  const code = generateCode();
  const code_hash = await hashCode(code);
  const expires_at = new Date(Date.now() + TTL_MS).toISOString();

  const { supabaseAdmin } = await import('@/lib/supabaseClient');

  // Single active code per (phone, purpose): consume any outstanding ones.
  await supabaseAdmin
    .from('phone_otp')
    .update({ consumed_at: new Date().toISOString() })
    .eq('phone', phone)
    .eq('purpose', purpose)
    .is('consumed_at', null);

  const { error } = await supabaseAdmin.from('phone_otp').insert({
    phone, purpose, code_hash, expires_at, school_id: schoolId,
  });
  if (error) {
    console.error('[otp] store failed for', maskPhone(phone), error.message);
    return { ok: false, sent: false };
  }

  const sent = await sendViaMsg91(phone, code);
  return { ok: true, sent };
}

/**
 * Verify a submitted code against the latest unconsumed OTP for (phone, purpose).
 * On success marks it consumed (single-use). Increments attempts on a wrong code.
 */
export async function verifyOtp(params: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ ok: boolean; reason?: string; schoolId?: string | null }> {
  const { phone, purpose, code } = params;
  if (!isOtpEnabled()) return { ok: false, reason: 'otp_disabled' };

  const { supabaseAdmin } = await import('@/lib/supabaseClient');

  const { data: rows } = await supabaseAdmin
    .from('phone_otp')
    .select('id, code_hash, expires_at, attempts, max_attempts, consumed_at, school_id')
    .eq('phone', phone)
    .eq('purpose', purpose)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return { ok: false, reason: 'no_code' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (row.attempts >= row.max_attempts) return { ok: false, reason: 'too_many_attempts' };

  const valid = await verifyCodeHash(code, row.code_hash);
  if (!valid) {
    await supabaseAdmin.from('phone_otp').update({ attempts: row.attempts + 1 }).eq('id', row.id);
    return { ok: false, reason: 'invalid' };
  }

  await supabaseAdmin.from('phone_otp').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
  return { ok: true, schoolId: row.school_id ?? null };
}
