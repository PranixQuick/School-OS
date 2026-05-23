// e2e/15-payment-razorpay.spec.ts
// Bible Phase 6 Priority 1: Fee creation + Razorpay webhook contract
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Payment & Razorpay webhook', () => {
  let adminCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'school_session');
    if (session) adminCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('fees page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/fees');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/admin/fees');
    await page.close();
  });

  test('razorpay webhook returns 200 for invalid signature (silent reject)', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/webhooks/razorpay`, {
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-signature': 'invalid_signature_000',
      },
      data: JSON.stringify({ event: 'payment.captured', payload: {} }),
    });
    // Always returns 200 to Razorpay (by design)
    expect(resp.status()).toBe(200);
  });

  test('razorpay webhook returns 200 for unknown event type', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/webhooks/razorpay`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ event: 'dispute.created', payload: {} }),
    });
    expect(resp.status()).toBe(200);
  });
});
