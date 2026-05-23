// e2e/16-hostel-allocation.spec.ts
// Bible Phase 6 Priority 2: Hostel module smoke test
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Hostel module', () => {
  test('hostel admin page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/hostel-admin');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/hostel');
    await page.close();
  });

  test('hostel settings page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/hostel');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/hostel');
    await page.close();
  });
});
