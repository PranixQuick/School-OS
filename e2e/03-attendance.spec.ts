// e2e/03-attendance.spec.ts
// Critical path: teacher attendance marking + retrieval.
// Tests the teacher attendance API directly.
import { test, expect } from '@playwright/test';
import { loginAsTeacher, BASE_URL } from './helpers/auth';

test.describe('Teacher attendance API', () => {
  let teacherCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsTeacher(page);
    const cookies = await page.context().cookies();
    // Use exact cookie name confirmed from lib/session.ts
    const session = cookies.find(c => c.name === 'school_session');
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
