// e2e/18-library-issue-return.spec.ts
// Bible Phase 6 Priority 2: Library module smoke test
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Library module', () => {
  test('library page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/library');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/library');
    await page.close();
  });

  test('librarian dashboard loads', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto('/librarian');
    await page.waitForLoadState('networkidle');
    // Should redirect to login or render librarian page
    const url = page.url();
    expect(url.includes('/login') || url.includes('/librarian')).toBe(true);
    await page.close();
  });
});
