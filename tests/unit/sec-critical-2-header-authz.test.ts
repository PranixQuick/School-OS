import { describe, it, expect } from 'vitest';
import type { NextRequest } from 'next/server';
import {
  getSchoolId,
  getUserRole,
  requireTenant,
  MissingSchoolIdError,
} from '@/lib/getSchoolId';

// ─────────────────────────────────────────────────────────────────────────────
// SEC-CRITICAL-2 regression test.
//
// This test is deliberately falsifiable: if anyone reverts lib/getSchoolId.ts
// to reading `x-school-id` / `x-user-role` from request headers, these
// assertions fail. That is the entire point — the previous implementation
// would have PASSED a test that only checked "returns a school id".
//
// The attack being regression-tested:
//   curl https://www.edprosys.com/api/whatsapp/conversations \
//     -H 'x-school-id: <victim school uuid>' \
//     -H 'x-user-role: owner'
// Under the old implementation this returned the victim school's WhatsApp
// message bodies and parent phone numbers. It must now be unauthenticated.
// ─────────────────────────────────────────────────────────────────────────────

const VICTIM_SCHOOL = '00000000-0000-0000-0000-000000000001';

/**
 * Builds a request that carries the forged identity headers an attacker would
 * send, and NO session cookie.
 */
function forgedRequest(): NextRequest {
  const headers = new Headers({
    'x-school-id': VICTIM_SCHOOL,
    'x-user-role': 'owner',
    'x-user-email': 'attacker@example.com',
  });
  return {
    headers,
    cookies: {
      get: (_name: string) => undefined,
    },
  } as unknown as NextRequest;
}

/**
 * Same forged headers, but this time also carrying a session cookie whose value
 * is not a valid signed JWT. Signature verification must reject it, and the
 * headers must not be used as a fallback.
 */
function forgedRequestWithGarbageCookie(): NextRequest {
  const headers = new Headers({
    'x-school-id': VICTIM_SCHOOL,
    'x-user-role': 'owner',
  });
  return {
    headers,
    cookies: {
      get: (name: string) =>
        name === 'school_session'
          ? { name, value: 'not.a.valid.jwt' }
          : undefined,
    },
  } as unknown as NextRequest;
}

describe('SEC-CRITICAL-2 — tenancy must come from the session, never headers', () => {
  it('getSchoolId() rejects a request that only carries x-school-id', async () => {
    await expect(getSchoolId(forgedRequest())).rejects.toBeInstanceOf(
      MissingSchoolIdError
    );
  });

  it('getSchoolId() never returns the school id supplied in the header', async () => {
    let returned: string | null = null;
    try {
      returned = await getSchoolId(forgedRequest());
    } catch {
      returned = null;
    }
    expect(returned).not.toBe(VICTIM_SCHOOL);
    expect(returned).toBeNull();
  });

  it('getUserRole() never echoes the x-user-role header', async () => {
    const role = await getUserRole(forgedRequest());
    expect(role).not.toBe('owner');
    expect(role).toBe('');
  });

  it('requireTenant() rejects forged headers', async () => {
    await expect(requireTenant(forgedRequest())).rejects.toBeInstanceOf(
      MissingSchoolIdError
    );
  });

  it('an unverifiable session cookie does not fall back to headers', async () => {
    await expect(
      getSchoolId(forgedRequestWithGarbageCookie())
    ).rejects.toBeInstanceOf(MissingSchoolIdError);
    expect(await getUserRole(forgedRequestWithGarbageCookie())).toBe('');
  });

  it('MissingSchoolIdError carries a 401 status for route handlers', () => {
    expect(new MissingSchoolIdError().status).toBe(401);
  });
});
