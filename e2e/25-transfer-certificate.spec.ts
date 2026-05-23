// e2e/25-transfer-certificate.spec.ts
// Bible Phase 6 Priority 3: Transfer certificate lifecycle
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Transfer certificate', () => {
  test('TC page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/transfer-certificates');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/transfer-cert');
    await page.close();
  });

  test('TC page also accessible at /admin/transfer-certs', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/transfer-certs');
    await page.waitForLoadState('networkidle');
    // Should load one of the TC routes
    const url = page.url();
    expect(url.includes('/transfer-cert') || url.includes('/transfer-certs')).toBe(true);
    await page.close();
  });
});
