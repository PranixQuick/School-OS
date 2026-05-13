// e2e/03-attendance.spec.ts
// Critical path: teacher attendance marking + retrieval.
// Tests the teacher attendance API directly.
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

const TEACHER_EMAIL    = process.env.TEST_TEACHER_EMAIL    ?? 'test.teacher@schoolos.local';
const TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD ?? 'schoolos0000';

test.describe('Teacher attendance API', () => {
  let teacherCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[type="email"], input[name="email"]', TEACHER_EMAIL);
    await page.fill('input[type="password"], input[name="password"]', TEACHER_PASSWORD);
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10_000 });
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name.includes('session') || c.name.includes('token'));
    if (session) teacherCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('GET /api/teacher/attendance returns class roster', async ({ request }) => {
    const today = new Date().toISOString().slice(0, 10);
    const resp = await request.get(
      `${BASE_URL}/api/teacher/attendance?class=5&section=A&date=${today}`,
      { headers: teacherCookie ? { cookie: teacherCookie } : {} }
    );
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('students');
    expect(Array.isArray(body.students)).toBe(true);
    expect(body).toHaveProperty('total');
  });

  test('attendance rejects future date', async ({ request }) => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    const futureDate = future.toISOString().slice(0, 10);
    const resp = await request.post(`${BASE_URL}/api/teacher/attendance`, {
      headers: {
        'Content-Type': 'application/json',
        ...(teacherCookie ? { cookie: teacherCookie } : {}),
      },
      data: { class: '5', section: 'A', date: futureDate, records: [] },
    });
    expect([400, 422]).toContain(resp.status());
  });

  test('attendance rejects date older than 7 days', async ({ request }) => {
    const old = new Date();
    old.setDate(old.getDate() - 10);
    const oldDate = old.toISOString().slice(0, 10);
    const resp = await request.post(`${BASE_URL}/api/teacher/attendance`, {
      headers: {
        'Content-Type': 'application/json',
        ...(teacherCookie ? { cookie: teacherCookie } : {}),
      },
      data: { class: '5', section: 'A', date: oldDate, records: [] },
    });
    expect([400, 422]).toContain(resp.status());
  });
});
