// lib/session.ts
// Phase 0 Task 0.1. Stateless signed-JWT session tokens (HS256, 7d, issuer school-os).
// Pure `jose` — safe to import from Edge Runtime (middleware.ts).
// Does NOT import supabase or next/headers to keep the edge bundle small.

import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

export interface SchoolSession {
  schoolId: string;
  schoolName: string;
  schoolSlug: string;
  plan: string;
  userId: string;
  userEmail: string;
  userRole: string;
  userName: string;
}

const ISSUER = 'school-os';
const DEFAULT_EXPIRY = '7d';
const LEGACY_EXPIRY = '24h';
const ALG = 'HS256';
export const SESSION_COOKIE = 'school_session';
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;
export const LEGACY_SESSION_MAX_AGE_SEC = 60 * 60 * 24;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.SESSION_SECRET);
}

export interface IssueSessionOptions {
  // Pass 'legacy' for the short-lived pre-migration session used when a user signs
  // in with the demo password. 'default' is the 7-day post-migration session.
  variant?: 'default' | 'legacy';
}

export async function issueSession(
  session: SchoolSession,
  opts: IssueSessionOptions = {}
): Promise<string> {
  const expiry = opts.variant === 'legacy' ? LEGACY_EXPIRY : DEFAULT_EXPIRY;
  return await new SignJWT({
    schoolId: session.schoolId,
    schoolName: session.schoolName,
    schoolSlug: session.schoolSlug,
    plan: session.plan,
    userId: session.userId,
    userEmail: session.userEmail,
    userRole: session.userRole,
    userName: session.userName,
    variant: opts.variant ?? 'default',
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setSubject(session.userId)
    .setExpirationTime(expiry)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined | null): Promise<SchoolSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      algorithms: [ALG],
    });
    if (
      typeof payload.schoolId !== 'string' ||
      typeof payload.userId !== 'string' ||
      typeof payload.userEmail !== 'string'
    ) {
      return null;
    }
    return {
      schoolId: payload.schoolId,
      schoolName: (payload.schoolName as string) ?? '',
      schoolSlug: (payload.schoolSlug as string) ?? '',
      plan: (payload.plan as string) ?? 'starter',
      userId: payload.userId,
      userEmail: payload.userEmail,
      userRole: (payload.userRole as string) ?? '',
      userName: (payload.userName as string) ?? '',
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string, isProduction: boolean) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: SESSION_MAX_AGE_SEC,
    path: '/',
  };
}

export function clearedSessionCookie(isProduction: boolean) {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  };
}

// JWTs are stateless; "revoke" here is a semantic marker the caller can use
// in combination with clearing the cookie. Persistent revocation would need
// a denylist table — out of scope for Phase 0.
export async function revokeSession(): Promise<void> {
  return;
}
