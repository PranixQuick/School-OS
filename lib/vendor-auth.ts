// lib/vendor-auth.ts
// ISS-7 (#7) — Vendor portal session auth.
// Mirrors lib/student-auth: JWT via jose (same SESSION_SECRET, separate issuer
// and cookie), bcrypt PIN. Vendors log in with portal_email + PIN and must have
// has_portal_access = true (granted by an admin) and be active.
// /vendor/* and /api/vendor/* are in middleware PUBLIC — this lib gates them.

import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { env } from '@/lib/env';

export const VENDOR_SESSION_COOKIE = 'vendor_session';
const VENDOR_SESSION_EXPIRY = '7d';
const VENDOR_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const ALG = 'HS256';
const ISSUER = 'school-os-vendor';

export interface VendorSession {
  vendorId: string;
  schoolId: string | null;
  institutionId: string | null;
  name: string;
  role: 'vendor';
}

export class VendorAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'VendorAuthError';
    this.status = status;
  }
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function verifyVendorPin(
  portalEmail: string,
  pin: string,
): Promise<{ id: string; name: string; school_id: string | null; institution_id: string | null } | null> {
  const email = portalEmail.trim().toLowerCase();
  if (!email || !pin) return null;

  const { data, error } = await supabaseAdmin
    .from('vendors')
    .select('id, name, school_id, institution_id, access_pin_hashed, has_portal_access, is_active')
    .eq('portal_email', email)
    .eq('has_portal_access', true)
    .eq('is_active', true);

  // Require exactly one match; an ambiguous portal_email never authenticates.
  if (error || !data || data.length !== 1) return null;
  const v = data[0];
  if (!v.access_pin_hashed) return null;

  const ok = await bcrypt.compare(pin, v.access_pin_hashed);
  if (!ok) return null;

  return { id: v.id, name: v.name, school_id: v.school_id, institution_id: v.institution_id };
}

export async function issueVendorSession(v: {
  id: string; name: string; school_id: string | null; institution_id: string | null;
}): Promise<string> {
  return await new SignJWT({
    vendorId: v.id,
    schoolId: v.school_id,
    institutionId: v.institution_id,
    name: v.name,
    role: 'vendor',
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setSubject(v.id)
    .setExpirationTime(VENDOR_SESSION_EXPIRY)
    .sign(secretKey());
}

export function vendorSessionCookie(token: string, isProduction: boolean) {
  return {
    name: VENDOR_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: VENDOR_SESSION_MAX_AGE,
    path: '/',
  };
}

export function clearedVendorSessionCookie(isProduction: boolean) {
  return {
    name: VENDOR_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
}

export async function verifyVendorSession(token: string | undefined | null): Promise<VendorSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, algorithms: [ALG] });
    if (typeof payload.vendorId !== 'string') return null;
    return {
      vendorId: payload.vendorId,
      schoolId: (payload.schoolId as string) ?? null,
      institutionId: (payload.institutionId as string) ?? null,
      name: (payload.name as string) ?? '',
      role: 'vendor',
    };
  } catch {
    return null;
  }
}

export async function requireVendorSession(req: NextRequest): Promise<VendorSession> {
  const token = req.cookies.get(VENDOR_SESSION_COOKIE)?.value;
  const session = await verifyVendorSession(token);
  if (!session) throw new VendorAuthError('No vendor session', 401);
  return session;
}

export function vendorAuthResponse(e: unknown): NextResponse {
  if (e instanceof VendorAuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  throw e;
}
