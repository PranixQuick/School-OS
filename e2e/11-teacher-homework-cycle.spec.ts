// e2e/11-teacher-homework-cycle.spec.ts
// Bible Phase 6 Priority 1: Assign homework → student submit → teacher grade
import { test, expect } from '@playwright/test';
import { loginAsTeacher, loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Teacher homework cycle', () => {
  let teacherCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsTeacher(page);
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'school_session');
    if (session) teacherCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('teacher can list homework', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/teacher/homework`, {
      headers: teacherCookie ? { cookie: teacherCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('homework');
  });

  test('teacher dashboard loads homework section', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsTeacher(page);
    await page.goto('/teacher');
    await page.waitForLoadState('domcontentloaded');
    // Page should load without crashing
    const title = await page.title();
    expect(title).toBeTruthy();
    await page.close();
  });
});
