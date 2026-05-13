// e2e/05-tc-lifecycle.spec.ts
// Critical path: transfer certificate creation + status check.
// Tests the TC API without issuing (which would mark student inactive).
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Transfer Certificate API', () => {
  let sessionCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'school_session');
    if (session) sessionCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('GET /api/admin/transfer-certificates returns array', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/admin/transfer-certificates`, {
      headers: sessionCookie ? { cookie: sessionCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('transfer_certificates');
    expect(Array.isArray(body.transfer_certificates)).toBe(true);
  });

  test('GET /api/admin/transfer-certificates?status=pending filters correctly', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/admin/transfer-certificates?status=pending`, {
      headers: sessionCookie ? { cookie: sessionCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status_filter).toBe('pending');
    // All returned TCs should be pending
    for (const tc of body.transfer_certificates) {
      expect(tc.status).toBe('pending');
    }
  });

  test('POST /api/admin/transfer-certificates rejects missing student_id', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/admin/transfer-certificates`, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
      data: { reason: 'Test', reason_category: 'transfer' }, // missing student_id
    });
    expect(resp.status()).toBe(400);
  });
});
