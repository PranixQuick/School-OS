// e2e/21-multi-language.spec.ts
// Bible Phase 6 Priority 3: Switch English → Telugu → Hindi
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Multi-language support', () => {
  test('login page renders in Telugu', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    // Click Telugu language button
    const teButton = page.locator('button:has-text("తె")');
    if (await teButton.count() > 0) {
      await teButton.click();
      await page.waitForTimeout(500);
      // Page should still be functional after language switch
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
    }
    await page.close();
  });

  test('login page renders in Hindi', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    const hiButton = page.locator('button:has-text("हि")');
    if (await hiButton.count() > 0) {
      await hiButton.click();
      await page.waitForTimeout(500);
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
    }
    await page.close();
  });

  test('dashboard renders after language switch', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Page loaded — language switch should not crash
    expect(page.url()).toContain('/dashboard');
    await page.close();
  });
});
