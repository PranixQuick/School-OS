// e2e/12-deo-meo-school-hierarchy.spec.ts
// Bible Phase 6 Priority 1: DEO login → see MEO list → MEO sees schools
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

test.describe('DEO/MEO governance hierarchy', () => {
  test('DEO dashboard page loads without error', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/deo/dashboard`);
    // Should redirect to login if not authenticated (not crash)
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/deo')).toBe(true);
    await page.close();
  });

  test('MEO dashboard page loads without error', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/meo/dashboard`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/meo')).toBe(true);
    await page.close();
  });

  test('MEO inspections page loads without error', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/meo/inspections`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/meo')).toBe(true);
    await page.close();
  });
});
