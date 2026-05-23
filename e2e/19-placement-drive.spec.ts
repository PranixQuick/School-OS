// e2e/19-placement-drive.spec.ts
// Bible Phase 6 Priority 2: Placement module smoke test (higher-ed)
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Placement module', () => {
  test('placement page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/placement');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/placement');
    await page.close();
  });

  test('internships page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/internships');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/internships');
    await page.close();
  });
});
