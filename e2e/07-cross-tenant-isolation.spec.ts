// e2e/07-cross-tenant-isolation.spec.ts
import { test, expect } from '@playwright/test';

const SUCHITRA_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@suchitracademy.edu.in';
const SUCHITRA_ADMIN_PASS  = process.env.TEST_ADMIN_PASSWORD || 'edprosys0000';
const SUCHITRA_SCHOOL_ID   = '00000000-0000-0000-0000-000000000001';
const SUCHITRA_STUDENT_ID  = '00000000-0000-0000-0000-000000000020';

const DPS_ADMIN_EMAIL = 'sushruth@dpsnadergul.com';
const DPS_ADMIN_PASS  = 'edprosys7304';
const DPS_SCHOOL_ID   = '73048703-f8aa-4668-981d-2cdf619767b3';

const SUCHITRA_PARENT_PHONE = '+919100000101';
const SUCHITRA_PARENT_PIN   = process.env.TEST_PARENT_PIN || '1234';

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

  // Parent login test: login as Suchitra admin first to anchor page to production,
  // then make parent login call via the same page.request (same context, proven origin).
  test('Suchitra parent login resolves to Suchitra school only', async ({ page }) => {
    // Anchor page to production by logging in (proven to reach production in every CI run)
    await loginWith(page, SUCHITRA_ADMIN_EMAIL, SUCHITRA_ADMIN_PASS);
    // Now page is at https://www.edprosys.com/dashboard — page.request origin is confirmed
    const res = await page.request.post('/api/parent/login', {
      data: { phone: SUCHITRA_PARENT_PHONE, pin: SUCHITRA_PARENT_PIN },
    });
    expect(res.status()).toBe(200);
    const body = await res.json() as { parent?: { school_id?: string } };
    expect(body.parent?.school_id).toBe(SUCHITRA_SCHOOL_ID);
    expect(body.parent?.school_id).not.toBe(DPS_SCHOOL_ID);
  });

});
