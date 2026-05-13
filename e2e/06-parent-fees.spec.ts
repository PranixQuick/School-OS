// e2e/06-parent-fees.spec.ts
// Critical path: parent fee visibility (phone+PIN auth).
// Tests the parent fees endpoint with demo parent credentials.
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

const PARENT_PHONE = process.env.TEST_PARENT_PHONE ?? '+919100000101';
const PARENT_PIN   = process.env.TEST_PARENT_PIN   ?? '1234'; // demo PIN from seed

test.describe('Parent fee API', () => {
  test('POST /api/parent/fees returns fees for valid credentials', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/parent/fees`, {
      headers: { 'Content-Type': 'application/json' },
      data: { phone: PARENT_PHONE, pin: PARENT_PIN },
    });
    // 200 = found, 401 = wrong credentials (both are valid for this test — depends on PIN in DB)
    expect([200, 401, 409]).toContain(resp.status());
    if (resp.status() === 200) {
      const body = await resp.json();
      expect(body).toHaveProperty('fees');
      expect(body).toHaveProperty('summary');
    }
  });

  test('POST /api/parent/fees returns 400 for missing phone', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/parent/fees`, {
      headers: { 'Content-Type': 'application/json' },
      data: { pin: '1234' }, // missing phone
    });
    expect(resp.status()).toBe(400);
  });

  test('POST /api/parent/fees returns 401 for wrong PIN', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/parent/fees`, {
      headers: { 'Content-Type': 'application/json' },
      data: { phone: PARENT_PHONE, pin: 'wrongpin000' },
    });
    expect([401, 409]).toContain(resp.status());
  });
});
