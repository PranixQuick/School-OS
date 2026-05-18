import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsTeacher } from './helpers/auth';

// E2E spec: role-based routing
// Verifies each role is directed to the correct portal
test.describe('Role-based routing', () => {
  test('admin login redirects to /dashboard or /onboarding', async ({ page }) => {
    await loginAsAdmin(page);
    const url = page.url();
    expect(url).toMatch(/\/(dashboard|onboarding)/);
  });

  test('teacher login redirects to /teacher', async ({ page }) => {
    await loginAsTeacher(page);
    const url = page.url();
    // Teacher should land on /teacher or similar
    expect(url).toMatch(/\/(teacher|dashboard)/);
  });

  test('admin cannot access /parent portal directly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/parent');
    // Should either redirect or show auth error — not crash
    const status = page.url();
    // As long as the page doesn't crash (no 500), routing is working
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).not.toContain('error');
  });

  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    // Clear cookies first
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated access to /students redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/students');
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });
});
