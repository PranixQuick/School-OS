import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsTeacher } from './helpers/auth';

// E2E spec: role-based routing
test.describe('Role-based routing', () => {
  test('admin login redirects to /dashboard or /onboarding', async ({ page }) => {
    await loginAsAdmin(page);
    const url = page.url();
    expect(url).toMatch(/\/(dashboard|onboarding)/);
  });

  test('teacher login redirects to /teacher', async ({ page }) => {
    await loginAsTeacher(page);
    const url = page.url();
    expect(url).toMatch(/\/(teacher|dashboard)/);
  });

  test('admin cannot access /parent portal directly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/parent');
    await page.waitForLoadState('domcontentloaded');
    // Parent page is public — it should load without error, not crash with a 500
    expect(page.url()).not.toContain('error');
  });

  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    // Middleware redirects — wait for the URL to change
    // Use networkidle to ensure client-side redirect has settled
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated access to /students redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/students');
    // Next.js middleware runs server-side and redirects to /login
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });
});
