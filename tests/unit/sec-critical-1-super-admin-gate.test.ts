import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isSuperAdmin,
  canManageInstitutions,
  canManageAccounts,
  __resetSuperAdminAllowlistForTests,
} from '@/lib/authz';

// ─────────────────────────────────────────────────────────────────────────────
// SEC-CRITICAL-1(a) regression test.
//
// The vulnerable implementation was:
//     export function isSuperAdmin(email: string): boolean {
//       return email.endsWith('@pranixailabs.com');
//     }
//
// Combined with the public POST /api/schools/create — which took admin_email
// from the request body and provisioned the user with email_confirm: true and
// returned the password in the response — anyone on the internet could mint
// platform-wide super-admin in three unauthenticated HTTP calls.
//
// Every assertion below fails against that implementation. That is the point:
// a test that merely checked "a pranixailabs address is a super admin" would
// have passed while the platform was wide open.
// ─────────────────────────────────────────────────────────────────────────────

const ENV_KEYS = ['SUPER_ADMIN_EMAILS', 'SUPER_ADMIN_EMAIL'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  __resetSuperAdminAllowlistForTests();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  __resetSuperAdminAllowlistForTests();
});

describe('SEC-CRITICAL-1(a) — super-admin must come from an explicit allowlist', () => {
  it('an operator-domain address is NOT a super admin by virtue of its domain', () => {
    expect(isSuperAdmin('attacker@pranixailabs.com')).toBe(false);
    expect(isSuperAdmin('anything@pranixailabs.com')).toBe(false);
    expect(isSuperAdmin('a.b.c+tag@pranixailabs.com')).toBe(false);
  });

  it('fails closed when no allowlist is configured', () => {
    expect(isSuperAdmin('founder@pranixailabs.com')).toBe(false);
    expect(isSuperAdmin('')).toBe(false);
  });

  it('honours an exact address on the allowlist', () => {
    process.env.SUPER_ADMIN_EMAILS = 'ops@example.com, founder@pranixailabs.com';
    __resetSuperAdminAllowlistForTests();

    expect(isSuperAdmin('ops@example.com')).toBe(true);
    expect(isSuperAdmin('founder@pranixailabs.com')).toBe(true);
    // ...but still not the rest of the domain.
    expect(isSuperAdmin('attacker@pranixailabs.com')).toBe(false);
  });

  it('matching is case-insensitive and whitespace-tolerant, but never partial', () => {
    process.env.SUPER_ADMIN_EMAILS = '  Ops@Example.com  ';
    __resetSuperAdminAllowlistForTests();

    expect(isSuperAdmin('ops@example.com')).toBe(true);
    expect(isSuperAdmin('OPS@EXAMPLE.COM')).toBe(true);

    // No suffix / prefix / substring matching.
    expect(isSuperAdmin('evil-ops@example.com')).toBe(false);
    expect(isSuperAdmin('ops@example.com.attacker.net')).toBe(false);
    expect(isSuperAdmin('ops@example.co')).toBe(false);
  });

  it('honours the legacy singular SUPER_ADMIN_EMAIL', () => {
    process.env.SUPER_ADMIN_EMAIL = 'legacy@example.com';
    __resetSuperAdminAllowlistForTests();
    expect(isSuperAdmin('legacy@example.com')).toBe(true);
  });

  it('downstream governance helpers no longer escalate on the domain', () => {
    // A brand-new self-registered "owner" on the operator domain must not be
    // able to manage institutions or accounts platform-wide.
    expect(canManageInstitutions('teacher', 'attacker@pranixailabs.com')).toBe(false);
    expect(canManageAccounts('teacher', 'attacker@pranixailabs.com', 'admin_only')).toBe(false);
  });
});
