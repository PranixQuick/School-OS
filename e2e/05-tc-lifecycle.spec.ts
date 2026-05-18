// e2e/05-tc-lifecycle.spec.ts
// Transfer certificate creation + status check.
// Uses page.request (browser context with full middleware pipeline).
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Transfer Certificate API', () => {
  test('GET /api/admin/transfer-certificates returns array', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.get('/api/admin/transfer-certificates');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('transfer_certificates');
    expect(Array.isArray(body.transfer_certificates)).toBe(true);
  });

  test('GET /api/admin/transfer-certificates?status=pending filters correctly', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.get('/api/admin/transfer-certificates?status=pending');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.status_filter).toBe('pending');
    for (const tc of body.transfer_certificates) {
      expect(tc.status).toBe('pending');
    }
  });

  test('POST /api/admin/transfer-certificates rejects missing student_id', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/transfer-certificates', {
      data: { reason: 'Test', reason_category: 'transfer' },
    });
    expect(resp.status()).toBe(400);
  });
});
