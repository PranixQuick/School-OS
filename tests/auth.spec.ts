import { test, expect, type BrowserContext } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'https://www.edprosys.com';
const BYPASS = process.env.E2E_BYPASS_SECRET ?? '';

// Read credentials from CI secrets, fall back to known demo values.
// auth.users passwords are set to these values via migration set_demo_passwords_for_ci.
const ADMIN = {
  email: process.env.TEST_ADMIN_EMAIL || 'admin@suchitracademy.edu.in',
  password: process.env.TEST_ADMIN_PASSWORD || 'edprosys0000',
};
const TEACHER = {
  email: process.env.TEST_TEACHER_EMAIL || 'ravi.kumar@suchitracademy.edu.in',
  password: process.env.TEST_TEACHER_PASSWORD || 'edprosys0000',
};

// Skip all authenticated tests unless E2E_BYPASS_SECRET is set and non-trivial.
// This prevents CI from hitting rate limits when the secret is absent.
const SKIP_AUTH = !BYPASS || BYPASS.length < 16;

// ── Login helper ──────────────────────────────────────────────
// Always sends x-e2e-bypass so rate limiting is skipped for CI accounts.
async function loginAs(
  context: BrowserContext,
  creds: { email: string; password: string }
): Promise<{ ok: boolean; role?: string; redirectTo?: string }> {
  const res = await context.request.post(`${BASE}/api/auth/login`, {
    data: { email: creds.email, password: creds.password },
    headers: { 'x-e2e-bypass': BYPASS },
  });
  if (!res.ok()) return { ok: false };
  const body = await res.json().catch(() => ({}));
  return { ok: true, role: body.role, redirectTo: body.redirectTo };
}

async function logout(context: BrowserContext): Promise<void> {
  await context.request.post(`${BASE}/api/auth/logout`);
}

// ── Admin auth flow ───────────────────────────────────────────
test.describe('Admin auth flow', () => {
  test.skip(SKIP_AUTH, 'E2E_BYPASS_SECRET not configured — skipping authenticated tests');

  test('Admin login → 200 + /dashboard redirect', async ({ request }) => {
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

  test('Admin: /api/admin/fees returns only Suchitra Academy data', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, ADMIN);

    const res = await context.request.get(`${BASE}/api/admin/fees`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const fees: { school_id?: string }[] = body.fees ?? [];
    fees.forEach(fee => {
      if (fee.school_id) {
        expect(fee.school_id).toBe('00000000-0000-0000-0000-000000000001');
      }
    });

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
});

// ── Teacher auth flow ─────────────────────────────────────────
test.describe('Teacher auth flow', () => {
  test.skip(SKIP_AUTH, 'E2E_BYPASS_SECRET not configured — skipping authenticated tests');

  test('Teacher login → 200 + /teacher redirect', async ({ request }) => {
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

  test('Teacher: /api/admin/staff returns 403 (role isolation)', async ({ browser }) => {
    const context = await browser.newContext();
    await loginAs(context, TEACHER);

    const res = await context.request.get(`${BASE}/api/admin/staff`);
    expect([401, 403]).toContain(res.status());

    await logout(context);
    await context.close();
  });
});

// ── Session management (always runs — no login needed) ────────
test.describe('Session management — no credentials required', () => {
  test('No cookie → /api/auth/me returns 401', async ({ browser }) => {
    const context = await browser.newContext();
    const res = await context.request.get(`${BASE}/api/auth/me`);
    expect([401, 403]).toContain(res.status());
    await context.close();
  });

  test('Garbage cookie → /api/auth/me returns 401', async ({ browser }) => {
    const context = await browser.newContext();
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

  test('No cookie → /api/admin/staff returns 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/staff`);
    expect([401, 403]).toContain(res.status());
  });

  test('No cookie → /api/admin/fees returns 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/fees`);
    expect([401, 403]).toContain(res.status());
  });
});
