// lib/parent-auth.ts
// Parent session management via JWT cookie.
// Follows same pattern as student-auth.ts.
// The parent login route issues a parent_session cookie on successful PIN auth.
// All /api/parent/* routes call getParentSession(req) to validate.

import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import { env } from '@/lib/env';

const COOKIE = 'parent_session';
const EXPIRY = '7d';
const MAX_AGE = 60 * 60 * 24 * 7;
const ALG = 'HS256';
const ISSUER = 'edprosys-parent';

export interface ParentSessionPayload {
  parentId: string;
  schoolId: string;
  studentId: string;
  phone: string;
}

function secret() {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function signParentSession(payload: ParentSessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(EXPIRY)
    .sign(secret());
}

export async function getParentSession(req: NextRequest): Promise<ParentSessionPayload | null> {
  try {
    const token = req.cookies.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER });
    return payload as unknown as ParentSessionPayload;
  } catch {
    return null;
  }
}

export function parentSessionCookieOptions() {
  return {
    name: COOKIE,
    maxAge: MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}
