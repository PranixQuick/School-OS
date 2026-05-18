// e2e/07-cross-tenant-isolation.spec.ts
// Cross-tenant data isolation test.

import { test, expect, Browser } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://www.edprosys.com';

const SUCHITRA_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@suchitracademy.edu.in';
const SUCHITRA_ADMIN_PASS  = process.env.TEST_ADMIN_PASSWORD || 'edprosys0000';
const SUCHITRA_SCHOOL_ID   = '00000000-0000-0000-0000-000000000001';
const SUCHITRA_STUDENT_ID  = '00000000-0000-0000-0000-000000000020';

const DPS_ADMIN_EMAIL = 'sushruth@dpsnadergul.com';
const DPS_ADMIN_PASS  = 'edprosys7304';
const DPS_SCHOOL_ID   = '73048703-f8aa-4668-981d-2cdf619767b3';

const SUCHITRA_PARENT_PHONE = '+919100000101';
const SUCHITRA_PARENT_PIN   = process.env.TEST_PARENT_PIN || '1234';

// Creates an isolated browser context with baseURL set, logs in, returns the page.
// Caller must call page.context().close() when done.
async function loginAndGetPage(browser: Browser, email: string, password: string) {
  // baseURL is required so relative URLs in p.request work correctly
  const ctx = await browser.newContext({ baseURL: BASE_URL });
  const p = await ctx.newPage();
  await p.goto('/login');
  await p.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15_000 });
  const bypass = process.env.E2E_BYPASS_SECRET || '';
  if (bypass) {
    await p.route('**/api/auth/login', async (route) => {
      await route.continue({ headers: { ...route.request().headers(), 'x-e2e-bypass': bypass } });
    });
  }
  await p.fill('input[type="email"]', email);
  await p.fill('input[type="password"]', password);
  const [res] = await Promise.all([
    p.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15_000 }),
    p.click('button[type="submit"]'),
  ]);
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  await p.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10_000 });
  return p;
}

test.describe('Cross-tenant data isolation', () => {

  test('Suchitra admin can list own students', async ({ browser }) => {
    const p = await loginAndGetPage(browser, SUCHITRA_ADMIN_EMAIL, SUCHITRA_ADMIN_PASS);
    const res = await p.request.get('/api/students');
    await p.context().close();
    expect(res.status()).toBe(200);
    const body = await res.json() as { students?: { id: string }[] };
    expect((body.students ?? []).map(s => s.id)).toContain(SUCHITRA_STUDENT_ID);
  });

  test('DPS admin cannot read Suchitra student data', async ({ browser }) => {
    const p = await loginAndGetPage(browser, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    const res = await p.request.get(`/api/students?id=${SUCHITRA_STUDENT_ID}`);
    await p.context().close();
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      expect((body.students ?? []).some(s => s.id === SUCHITRA_STUDENT_ID)).toBe(false);
    } else {
      expect([401, 403, 404]).toContain(res.status());
    }
  });

  test('DPS admin student list contains no Suchitra students', async ({ browser }) => {
    const p = await loginAndGetPage(browser, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    const res = await p.request.get('/api/students');
    await p.context().close();
    expect([200, 401, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      expect((body.students ?? []).some(s => s.id === SUCHITRA_STUDENT_ID)).toBe(false);
    }
  });

  // Parent login is a fully public endpoint — no session or browser context needed.
  // Uses the bare request fixture which makes a clean HTTP call with no cookies.
  test('Suchitra parent login resolves to Suchitra school only', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/parent/login`, {
      data: { phone: SUCHITRA_PARENT_PHONE, pin: SUCHITRA_PARENT_PIN },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { parent?: { school_id?: string } };
    expect(body.parent?.school_id).toBe(SUCHITRA_SCHOOL_ID);
    expect(body.parent?.school_id).not.toBe(DPS_SCHOOL_ID);
  });

});
