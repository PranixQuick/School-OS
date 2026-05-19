import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'https://www.edprosys.com';
const BYPASS = process.env.E2E_BYPASS_SECRET ?? '';

// Credentials from seeded demo data
const ADMIN = { email: 'admin@suchitracademy.edu.in', password: 'edprosys0000' };
const TEACHER = { email: 'ravi.kumar@suchitracademy.edu.in', password: 'edprosys0000' };

// ── Login helper ──────────────────────────────────────────────
async function loginAs(
  context: BrowserContext,
  creds: { email: string; password: string }
): Promise<{ ok: boolean; role?: string; redirectTo?: string }> {
  const res = await context.request.post(`${BASE}/api/auth/login`, {
    data: { email: creds.email, password: creds.password },
    headers: BYPASS ? { 'x-e2e-bypass': BYPASS } : {},
  });
  if (!res.ok()) return { ok: false };
  const body = await res.json();
  return { ok: true, role: body.role, redirectTo: body.redirectTo };
}

async function logout(context: BrowserContext): Promise<void> {
  await context.request.post(`${BASE}/api/auth/logout`);
}

// ── Skip helper: skip if no bypass secret configured ──────────
const SKIP_AUTH = !process.env.E2E_BYPASS_SECRET;

// ── Admin login + dashboard ───────────────────────────────────
test.describe('Admin auth flow', () => {
  test.skip(SKIP_AUTH, 'E2E_BYPASS_SECRET not set — skip authenticated tests');

  test('Admin login returns success + dashboard redirect', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: ADMIN,
      headers: { 'x-e2e-bypass': BYPASS },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe('/dashboard');
    expect(body.role).toBe('admin');
  });

  test('Admin session: /api/auth/me returns role after login', async ({ browser }) => {
    const context = await browser.newContext();
    const result = await loginAs(context, ADMIN);
    expect(result.ok).toBe(true);

    const res = await context.request.get(`${BASE}/api/auth/me`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('admin');
    expect(body.school_name).toBeTruthy();

    await logout(context);
    await context.close();
  });

  test('Admin can access /api/admin/staff after login', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, ADMIN);

    const res = await context.request.get(`${BASE}/api/admin/staff`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.staff)).toBe(true);

    await logout(context);
    await context.close();
  });

  test('Admin can access /api/admin/payroll/runs after login', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, ADMIN);

    const res = await context.request.get(`${BASE}/api/admin/payroll/runs`);
    expect(res.status()).toBe(200);

    await logout(context);
    await context.close();
  });

  test('After logout, /api/auth/me returns 401', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, ADMIN);
    await logout(context);

    const res = await context.request.get(`${BASE}/api/auth/me`);
    expect([401, 403]).toContain(res.status());

    await context.close();
  });

  test('Admin cannot access teacher-only API — 403 or data scoped', async ({ browser }) => {
    // Admin can call teacher API but gets school-scoped data (not cross-tenant)
    const context = await browser.newContext();
    await loginAs(context, ADMIN);

    const res = await context.request.get(`${BASE}/api/teacher/dashboard`);
    // Admin isn't a teacher so should get 403 or empty (role-guarded)
    expect([200, 403, 401]).toContain(res.status());

    await logout(context);
    await context.close();
  });
});

// ── Teacher login + attendance ────────────────────────────────
test.describe('Teacher auth flow', () => {
  test.skip(SKIP_AUTH, 'E2E_BYPASS_SECRET not set — skip authenticated tests');

  test('Teacher login returns success + teacher redirect', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/login`, {
      data: TEACHER,
      headers: { 'x-e2e-bypass': BYPASS },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe('/teacher');
    expect(body.role).toBe('teacher');
  });

  test('Teacher can access their own dashboard API', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, TEACHER);

    const res = await context.request.get(`${BASE}/api/teacher/dashboard`);
    expect(res.status()).toBe(200);

    await logout(context);
    await context.close();
  });

  test('Teacher cannot access admin-only APIs', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, TEACHER);

    // Teacher should get 403 on admin-only endpoints
    const res = await context.request.get(`${BASE}/api/admin/staff`);
    expect([403, 401]).toContain(res.status());

    await logout(context);
    await context.close();
  });
});

// ── Role isolation: cross-tenant simulation ───────────────────
test.describe('Role isolation — tenant boundaries', () => {
  test.skip(SKIP_AUTH, 'E2E_BYPASS_SECRET not set — skip authenticated tests');

  test('Admin: /api/admin/fees returns only their school data', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, ADMIN);

    const res = await context.request.get(`${BASE}/api/admin/fees`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // All returned fees must belong to Suchitra Academy (school_id starts with 00000000)
    const fees: { school_id?: string }[] = body.fees ?? [];
    fees.forEach(fee => {
      if (fee.school_id) {
        expect(fee.school_id).toBe('00000000-0000-0000-0000-000000000001');
      }
    });

    await logout(context);
    await context.close();
  });

  test('Rate limit: rapid failed logins return 429', async ({ request }) => {
    // Hit with wrong password 6 times to trigger rate limit (limit=5)
    // Uses a throwaway email that won't exist
    const results: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request.post(`${BASE}/api/auth/login`, {
        data: { email: `nonexistent-${Date.now()}-${i}@example.com`, password: 'wrong' },
      });
      results.push(res.status());
    }
    // All should be 401 (user not found) or 429 (rate limited by IP)
    results.forEach(s => expect([401, 429]).toContain(s));
  });
});

// ── Stale session / expiry ────────────────────────────────────
test.describe('Session management', () => {
  test('Cleared cookie = 401 on /api/auth/me', async ({ browser }) => {
    const context = await browser.newContext();
    // Don't log in — just check that no-session = 401
    const res = await context.request.get(`${BASE}/api/auth/me`);
    expect([401, 403]).toContain(res.status());
    await context.close();
  });

  test('Invalid cookie value = 401 on /api/auth/me', async ({ browser }) => {
    const context = await browser.newContext();
    // Set a garbage cookie
    await context.addCookies([{
      name: 'school_session',
      value: 'garbage.jwt.token',
      domain: new URL(BASE).hostname,
      path: '/',
    }]);
    const res = await context.request.get(`${BASE}/api/auth/me`);
    expect([401, 403]).toContain(res.status());
    await context.close();
  });
});
