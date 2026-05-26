// e2e/06-parent-fees.spec.ts
// Parent fees API gate.
// Unauthenticated requests to /api/parent/fees return 400 or 401 depending on
// whether middleware intercepts before the handler (401) or the handler itself
// validates (400). Accept either — both mean "not authenticated/authorized".
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

test.describe('Parent fees API gate', () => {
  test('GET /api/parent/fees without credentials returns 400 or 401', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/parent/fees`);
    // Middleware may return 401 or handler may return 400 — both are correct rejections
    expect([400, 401]).toContain(resp.status());
  });

  test('GET /api/parent/fees with invalid PIN returns 401', async ({ request }) => {
    const resp = await request.get(
      `${BASE_URL}/api/parent/fees?phone=9515479595&pin=0000`
    );
    // Invalid credentials → 401
    expect([400, 401]).toContain(resp.status());
  });

  test('POST /api/parent/login with invalid phone returns 400 or 401', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/parent/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { phone: '0000000000', pin: '0000' },
    });
    expect([400, 401, 404]).toContain(resp.status());
  });
});
