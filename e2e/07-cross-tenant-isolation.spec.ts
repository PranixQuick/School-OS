// e2e/07-cross-tenant-isolation.spec.ts
// Phase D — D1: Cross-tenant data isolation test.
// Uses page.request (browser context) so middleware injects x-school-id headers.
// The bare request fixture bypasses the edge middleware and always gets 401.

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

// Helper: log into a school and return a page with that school's session active
async function loginAndGetPage(browser: Browser, email: string, password: string) {
  const ctx = await browser.newContext({ baseURL: BASE_URL });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15_000 });
  const bypassSecret = process.env.E2E_BYPASS_SECRET || '';
  if (bypassSecret) {
    await page.route('**/api/auth/login', async (route) => {
      await route.continue({ headers: { ...route.request().headers(), 'x-e2e-bypass': bypassSecret } });
    });
  }
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  const [res] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/auth/login') && r.request().method() === 'POST', { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
  if (!res.ok()) throw new Error(`Login failed: ${res.status()}`);
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10_000 });
  return page;
}

test.describe('Cross-tenant data isolation', () => {

  test('Suchitra admin can list own students', async ({ browser }) => {
    const page = await loginAndGetPage(browser, SUCHITRA_ADMIN_EMAIL, SUCHITRA_ADMIN_PASS);
    const res = await page.request.get('/api/students');
    expect(res.status()).toBe(200);
    const body = await res.json() as { students?: { id: string }[] };
    const ids = (body.students ?? []).map(s => s.id);
    expect(ids).toContain(SUCHITRA_STUDENT_ID);
    await page.context().close();
  });

  test('DPS admin cannot read Suchitra student data', async ({ browser }) => {
    const page = await loginAndGetPage(browser, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    const res = await page.request.get(`/api/students?id=${SUCHITRA_STUDENT_ID}`);
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      const leaks = (body.students ?? []).some(s => s.id === SUCHITRA_STUDENT_ID);
      expect(leaks).toBe(false);
    } else {
      expect([403, 404]).toContain(res.status());
    }
    await page.context().close();
  });

  test('DPS admin student list contains no Suchitra students', async ({ browser }) => {
    const page = await loginAndGetPage(browser, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    const res = await page.request.get('/api/students');
    expect(res.status()).not.toBe(500);
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      const leaks = (body.students ?? []).some(s => s.id === SUCHITRA_STUDENT_ID);
      expect(leaks).toBe(false);
    }
    await page.context().close();
  });

  test('Suchitra parent login resolves to Suchitra school only', async ({ page }) => {
    const res = await page.request.post(`${BASE_URL}/api/parent/login`, {
      data: { phone: SUCHITRA_PARENT_PHONE, pin: SUCHITRA_PARENT_PIN },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { parent?: { school_id?: string } };
    expect(body.parent?.school_id).toBe(SUCHITRA_SCHOOL_ID);
    expect(body.parent?.school_id).not.toBe(DPS_SCHOOL_ID);
  });

});
