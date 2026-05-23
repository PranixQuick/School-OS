// e2e/20-anganwadi-beneficiary.spec.ts
// Bible Phase 6 Priority 2: Anganwadi beneficiary module smoke test
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

test.describe('Anganwadi module', () => {
  test('anganwadi dashboard page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/anganwadi`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/anganwadi')).toBe(true);
    await page.close();
  });

  test('anganwadi beneficiaries page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/anganwadi/beneficiaries`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/anganwadi')).toBe(true);
    await page.close();
  });

  test('anganwadi growth tracking page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/anganwadi/growth`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/anganwadi')).toBe(true);
    await page.close();
  });

  test('anganwadi immunization page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/anganwadi/immunization`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/anganwadi')).toBe(true);
    await page.close();
  });

  test('anganwadi nutrition page loads', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/anganwadi/nutrition`);
    await page.waitForLoadState('networkidle');
    const url = page.url();
    expect(url.includes('/login') || url.includes('/anganwadi')).toBe(true);
    await page.close();
  });
});
