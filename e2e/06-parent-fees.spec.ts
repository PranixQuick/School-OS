// e2e/06-parent-fees.spec.ts
// Parent fees visibility — tests unauthenticated rejection only.
// Parent auth uses phone+PIN (no OTP in test env). Authenticated paths
// are validated via unit tests; E2E validates the auth gate only.
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

test.describe('Parent fees auth gate', () => {
  test('GET /api/parent/fees without session returns 401', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/parent/fees`);
    expect([401, 403]).toContain(resp.status());
  });

  test('GET /api/parent/attendance without session returns 401', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/parent/attendance`);
    expect([401, 403]).toContain(resp.status());
  });

  test('GET /api/parent/consent without session returns 401', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/parent/consent`);
    expect([401, 403]).toContain(resp.status());
  });

  test('POST /api/parent/login with invalid phone returns 400 or 404', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/parent/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: { phone: '0000000000', pin: '0000' },
    });
    expect([400, 401, 404]).toContain(resp.status());
  });
});
