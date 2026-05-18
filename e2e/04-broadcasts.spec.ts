// e2e/04-broadcasts.spec.ts
// Broadcast send + history retrieval.
// Uses page.request (browser context with full middleware pipeline).
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Broadcast API', () => {
  test('GET /api/admin/broadcast returns broadcast history array', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.get('/api/admin/broadcast');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('broadcasts');
    expect(Array.isArray(body.broadcasts)).toBe(true);
  });

  test('POST /api/admin/broadcast creates broadcast notification', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/broadcast', {
      data: {
        subject: 'E2E Test Broadcast',
        message: 'This is a test broadcast from the E2E suite. Please ignore.',
      },
    });
    expect([200, 201]).toContain(resp.status());
  });

  test('POST /api/admin/broadcast rejects empty message', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/broadcast', {
      data: { subject: 'No message', message: '' },
    });
    expect(resp.status()).toBeGreaterThanOrEqual(400);
  });
});
