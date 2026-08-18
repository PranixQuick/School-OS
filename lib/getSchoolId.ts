import type { NextRequest } from 'next/server';
import { getSession } from './auth';
import type { SchoolSession } from './session';

// ─────────────────────────────────────────────────────────────────────────────
// SEC-CRITICAL-2 — 2026-08-17
//
// PREVIOUS BEHAVIOUR (vulnerable):
//   getSchoolId() read the `x-school-id` request header and getUserRole() read
//   the `x-user-role` request header. The file comment claimed these were
//   "set by middleware from session cookie".
//
//   That claim was false. `middleware.ts` short-circuits every `/api/*` path
//   with `return NextResponse.next()` and never reads the session cookie,
//   never injects a header, and never strips a client-supplied one. An audit
//   of the entire repo (app/, lib/, components/, next.config, vercel.json,
//   the Capacitor wrapper and the service worker) found NO code anywhere that
//   sets these headers.
//
//   Consequences, both confirmed:
//     1. SECURITY — any external caller could send
//          x-school-id: <any school uuid>
//          x-user-role: owner
//        and be served, and trusted, as that school's owner. 18 routes were
//        affected, including WhatsApp conversation history (message bodies +
//        parent phone numbers), bulk staff import (cross-tenant write) and the
//        manual cron trigger (mass WhatsApp/SMS sends at company cost).
//     2. FUNCTIONALITY — a genuine logged-in user's browser sends the
//        `school_session` cookie but never these headers, so these same routes
//        threw MissingSchoolIdError for real users. They were broken.
//
// CURRENT BEHAVIOUR (fixed):
//   Tenancy is derived exclusively from the HS256-signed `school_session`
//   cookie via getSession() -> verifySession(), which validates the signature,
//   the issuer, the expiry and the revocation denylist. Request headers are
//   never consulted. There is no way for a caller to assert a school_id or a
//   role that the signed session does not already carry.
//
//   These functions are now ASYNC because signature verification is async.
//   That is deliberate: it makes TypeScript surface every remaining call site
//   at compile time rather than failing silently at runtime.
//
//   middleware.ts additionally strips inbound x-school-id / x-user-role /
//   x-user-email headers as defence in depth, so a future regression that
//   reintroduces header-reading cannot be exploited from outside.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a request carries no valid school session.
 * Carries `status = 401` so route handlers can map it directly.
 */
export class MissingSchoolIdError extends Error {
  readonly status = 401;

  constructor(message?: string) {
    super(
      message ??
        'Unauthenticated — a valid school_session cookie is required. ' +
          'This route derives its tenant from the signed session; it does not ' +
          'accept an x-school-id header.'
    );
    this.name = 'MissingSchoolIdError';
  }
}

export interface TenantContext {
  schoolId: string;
  userId: string;
  email: string;
  role: string;
  session: SchoolSession;
}

/**
 * Preferred accessor. Verifies the session ONCE and returns everything a route
 * needs. Use this instead of calling getSchoolId() and getUserRole() separately
 * — each call performs its own JWT verification and revocation-denylist lookup.
 *
 * @throws {MissingSchoolIdError} when there is no valid session.
 */
export async function requireTenant(req: NextRequest): Promise<TenantContext> {
  const session = await getSession(req);
  if (!session || !session.schoolId) {
    throw new MissingSchoolIdError();
  }
  return {
    schoolId: session.schoolId,
    userId: session.userId,
    email: session.userEmail,
    role: session.userRole ?? '',
    session,
  };
}

/**
 * Returns the caller's school_id, taken from the verified session cookie.
 *
 * @throws {MissingSchoolIdError} when there is no valid session.
 */
export async function getSchoolId(req: NextRequest): Promise<string> {
  const ctx = await requireTenant(req);
  return ctx.schoolId;
}

/**
 * Returns the caller's role from the verified session cookie, or '' when there
 * is no valid session. Does not throw — callers that require a role should
 * check the return value, or use requireTenant() when they also need the
 * school_id.
 */
export async function getUserRole(req: NextRequest): Promise<string> {
  const session = await getSession(req);
  return session?.userRole ?? '';
}

/**
 * Convenience for the common `catch` in a route handler: converts a
 * MissingSchoolIdError into its HTTP status, and rethrows anything else.
 */
export function isMissingSchoolId(err: unknown): err is MissingSchoolIdError {
  return err instanceof MissingSchoolIdError;
}
