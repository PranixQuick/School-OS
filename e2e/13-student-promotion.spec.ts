// e2e/13-student-promotion.spec.ts
// Bible Phase 6 Priority 1: Promotion rules + next class assignment
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Student promotion', () => {
  let adminCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'school_session');
    if (session) adminCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('promotion page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/promotion');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/admin/promotion');
    await page.close();
  });

  test('students API returns student list with class info', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/students?limit=5`, {
      headers: adminCookie ? { cookie: adminCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('students');
    if (body.students.length > 0) {
      expect(body.students[0]).toHaveProperty('class');
    }
  });
});
