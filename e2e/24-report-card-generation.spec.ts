// e2e/24-report-card-generation.spec.ts
// Bible Phase 6 Priority 3: Report card generation
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Report card generation', () => {
  test('report cards page loads for admin', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/report-cards');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/report-cards');
    await page.close();
  });

  test('admin report-cards settings page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/admin/report-cards');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/report-cards');
    await page.close();
  });
});
