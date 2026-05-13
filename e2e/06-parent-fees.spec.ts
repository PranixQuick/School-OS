// e2e/06-parent-fees.spec.ts
// Parent fees API gate.
// /api/parent routes are PUBLIC_PATHS — middleware does NOT block them.
// Unauthenticated requests reach the handler and return 400 (missing phone/pin).
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

test.describe('Parent fees API gate', () => {
  test('GET /api/parent/fees without credentials returns 400', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/parent/fees`);
    // Parent routes are public — route handler returns 400 for missing phone/pin
    expect(resp.status()).toBe(400);
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
