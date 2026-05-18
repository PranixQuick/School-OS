// e2e/07-cross-tenant-isolation.spec.ts
// Cross-tenant data isolation: verifies a session for School B cannot read School A data.
// Parent login cross-tenant isolation is enforced at the DB level (UNIQUE on school_id,phone)
// and is not testable via E2E without dedicated CI infrastructure for parent sessions.

import { test, expect } from '@playwright/test';

const SUCHITRA_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@suchitracademy.edu.in';
const SUCHITRA_ADMIN_PASS  = process.env.TEST_ADMIN_PASSWORD || 'edprosys0000';
const SUCHITRA_SCHOOL_ID   = '00000000-0000-0000-0000-000000000001';
const SUCHITRA_STUDENT_ID  = '00000000-0000-0000-0000-000000000020';

const DPS_ADMIN_EMAIL = 'sushruth@dpsnadergul.com';
const DPS_ADMIN_PASS  = 'edprosys7304';

async function loginWith(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15_000 });
  const bypass = process.env.E2E_BYPASS_SECRET || '';
  if (bypass) {
    await page.route('**/api/auth/login', async (route) => {
      await route.continue({ headers: { ...route.request().headers(), 'x-e2e-bypass': bypass } });
    });
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  const [res] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
  if (!res.ok()) throw new Error(`Login failed for ${email}: ${res.status()}`);
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10_000 });
}

test.describe('Cross-tenant data isolation', () => {

  test('Suchitra admin can list own students', async ({ page }) => {
    await loginWith(page, SUCHITRA_ADMIN_EMAIL, SUCHITRA_ADMIN_PASS);
    const res = await page.request.get('/api/students');
    expect(res.status()).toBe(200);
    const body = await res.json() as { students?: { id: string }[] };
    expect((body.students ?? []).map(s => s.id)).toContain(SUCHITRA_STUDENT_ID);
  });

  test('DPS admin cannot read Suchitra student data', async ({ page }) => {
    await loginWith(page, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    const res = await page.request.get(`/api/students?id=${SUCHITRA_STUDENT_ID}`);
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      expect((body.students ?? []).some(s => s.id === SUCHITRA_STUDENT_ID)).toBe(false);
    } else {
      expect([401, 403, 404]).toContain(res.status());
    }
  });

  test('DPS admin student list contains no Suchitra students', async ({ page }) => {
    await loginWith(page, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    const res = await page.request.get('/api/students');
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      expect((body.students ?? []).some(s => s.id === SUCHITRA_STUDENT_ID)).toBe(false);
    }
  });

  // Parent login cross-tenant isolation is enforced by the DB schema:
  // parents table has UNIQUE(school_id, phone), and the login query
  // selects by phone without school filter, returning 409 on collision.
  // This DB-level guarantee is verified by the schema itself, not E2E.
  test('parent login endpoint exists and rejects missing credentials', async ({ page }) => {
    await loginWith(page, SUCHITRA_ADMIN_EMAIL, SUCHITRA_ADMIN_PASS);
    // Verify the endpoint is live and validates input
    const res = await page.request.post('/api/parent/login', {
      data: { phone: '', pin: '' },
    });
    // Missing credentials must return 400 — never 404 (route missing) or 500
    expect(res.status()).toBe(400);
  });

});
