// e2e/17-transport-trip-attendance.spec.ts
// Bible Phase 6 Priority 2: Transport module smoke test
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Transport module', () => {
  test('transport page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/transport');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/transport');
    await page.close();
  });
});
