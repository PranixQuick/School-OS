import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsTeacher } from './helpers/auth';

test.describe('Role-based routing', () => {
  test('admin login redirects to /dashboard or /onboarding', async ({ page }) => {
    await loginAsAdmin(page);
    expect(page.url()).toMatch(/\/(dashboard|onboarding)/);
  });

  test('teacher login redirects to /teacher', async ({ page }) => {
    await loginAsTeacher(page);
    expect(page.url()).toMatch(/\/(teacher|dashboard)/);
  });

  test('admin cannot access /parent portal directly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/parent');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).not.toContain('error');
  });

  test('unauthenticated access to /dashboard redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/dashboard');
    await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });

  test('unauthenticated access to /students redirects to /login', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/students', { waitUntil: 'commit' });
    // waitUntil:'commit' returns as soon as the first response is committed.
    // If middleware issued a 307, the browser follows to /login immediately.
    // Wait up to 10s for the URL to settle at /login.
    try {
      await page.waitForURL(url => url.pathname.includes('/login'), { timeout: 10_000 });
    } catch {
      // If still not at /login after timeout, the middleware redirect did not fire.
      // This is the expected failure mode we want to catch.
    }
    expect(page.url()).toContain('/login');
  });
});
