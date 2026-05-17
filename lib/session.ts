// lib/session.ts
// Stateless signed-JWT session tokens (HS256, 7d, issuer school-os).
// Pure jose — safe to import from Edge Runtime (middleware.ts).
// AG-5 fix: revokeSession() now writes to revoked_sessions denylist.
// verifySession() checks the denylist on every call.
// The denylist is purged automatically via DB trigger after 8 days.

import { SignJWT, jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';
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

// Lazy supabase admin client — only created if revocation is used.
// Avoids importing supabase into edge-runtime-only contexts where it would
// fail; callers that need denylist checks (server-side API routes) always
// run in Node runtime.
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface IssueSessionOptions {
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

    // AG-5: Check revocation denylist.
    // payload.sub is userId, payload.iat is issue timestamp.
    // Both together uniquely identify this token.
    // Fail-open on DB error so a Supabase outage doesn't lock everyone out.
    if (payload.sub && payload.iat) {
      try {
        const { data } = await adminClient()
          .from('revoked_sessions')
          .select('id')
          .eq('user_id', payload.sub)
          .eq('issued_at', payload.iat)
          .maybeSingle();
        if (data) return null; // token is revoked
      } catch {
        // Fail-open: if denylist check fails, allow the session
        // to avoid locking users out on DB errors
      }
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

// AG-5: revokeSession now writes to the denylist.
// Accepts the raw token so it can extract userId + iat.
// Falls back silently on error so logout always clears the cookie
// even if the DB write fails.
export async function revokeSession(
  token?: string,
  opts?: { reason?: string; ip?: string }
): Promise<void> {
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: ISSUER,
      algorithms: [ALG],
    });
    if (payload.sub && payload.iat) {
      await adminClient()
        .from('revoked_sessions')
        .upsert(
          {
            user_id: payload.sub,
            issued_at: payload.iat,
            reason: opts?.reason ?? 'logout',
            ip: opts?.ip ?? null,
          },
          { onConflict: 'user_id,issued_at', ignoreDuplicates: true }
        );
    }
  } catch {
    // Fail silently — logout must always succeed from the user's perspective
  }
}
