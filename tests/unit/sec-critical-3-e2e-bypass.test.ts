import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isE2EBypass } from '@/lib/rate-limit';

// SEC-CRITICAL-3 regression test.
//
// The vulnerable implementation was:
//     export function isE2EBypass(headerValue: string | null): boolean {
//       const secret = process.env.E2E_BYPASS_SECRET;
//       if (!secret || secret.length < 16) return false;
//       return headerValue === secret;
//     }
//
// In app/api/auth/login/route.ts the branch this guards issues a real,
// full-privilege session for ANY active row in school_users - no password, and
// it returns BEFORE enforceLoginRateLimit(). CI ran the E2E suite against
// production with E2E_BYPASS_SECRET set, so production had it configured. One
// static, never-rotated string unlocked every account in every tenant.
//
// The first tests below fail against that implementation. The rest pin the
// behaviour CI depends on, so a future "just disable it everywhere" change
// cannot silently break the PR gate.

const SECRET = 'a-sufficiently-long-e2e-secret-value';
const KEYS = ['VERCEL_ENV', 'E2E_BYPASS_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('SEC-CRITICAL-3 - the E2E login bypass must be dead on production', () => {
  it('refuses the correct secret when VERCEL_ENV is production', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.E2E_BYPASS_SECRET = SECRET;
    // The caller knows the secret. On production that must still not be enough.
    expect(isE2EBypass(SECRET)).toBe(false);
  });

  it('production wins even though the secret is long enough and matches', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.E2E_BYPASS_SECRET = SECRET;
    expect(SECRET.length).toBeGreaterThanOrEqual(16);
    expect(isE2EBypass(SECRET)).toBe(false);
  });

  it('still works on preview and in CI, which is where it is legitimate', () => {
    // No VERCEL_ENV at all - this is CI running `next start` on localhost.
    process.env.E2E_BYPASS_SECRET = SECRET;
    expect(isE2EBypass(SECRET)).toBe(true);

    process.env.VERCEL_ENV = 'preview';
    expect(isE2EBypass(SECRET)).toBe(true);
  });

  it('rejects a wrong or absent header off production', () => {
    process.env.E2E_BYPASS_SECRET = SECRET;
    expect(isE2EBypass(null)).toBe(false);
    expect(isE2EBypass('')).toBe(false);
    expect(isE2EBypass('wrong')).toBe(false);
    // A prefix must not pass - guards against a sloppy startsWith refactor.
    expect(isE2EBypass(SECRET.slice(0, -1))).toBe(false);
    expect(isE2EBypass(SECRET + 'x')).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(isE2EBypass('anything')).toBe(false);
    process.env.E2E_BYPASS_SECRET = 'tooshort';
    expect(isE2EBypass('tooshort')).toBe(false);
  });
});
