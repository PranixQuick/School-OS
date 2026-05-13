// e2e/04-broadcasts.spec.ts
// Critical path: broadcast send + history retrieval.
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Broadcast API', () => {
  let sessionCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name.includes('session') || c.name.includes('token'));
    if (session) sessionCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('GET /api/admin/broadcast returns broadcast history array', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/admin/broadcast`, {
      headers: sessionCookie ? { cookie: sessionCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('broadcasts');
    expect(Array.isArray(body.broadcasts)).toBe(true);
  });

  test('POST /api/admin/broadcast creates broadcast notification', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/admin/broadcast`, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
      data: {
        subject: 'E2E Test Broadcast',
        message: 'This is a test broadcast from the E2E test suite. Please ignore.',
      },
    });
    // Accept 200 or 201
    expect([200, 201]).toContain(resp.status());
  });

  test('POST /api/admin/broadcast rejects empty message', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/admin/broadcast`, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
      data: { subject: 'No message', message: '' },
    });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  });
});
