// e2e/01-admin-login.spec.ts
// Critical path: admin login flow.
// Verifies: login page loads, credentials accepted, redirect to dashboard.
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Admin login', () => {
  test('login page loads and shows form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('form')).toBeVisible({ timeout: 8_000 });
    // Expects at least one password input
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('admin credentials log in and redirect to dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    // After login: should NOT be on /login
    expect(page.url()).not.toContain('/login');
    // Should land on /dashboard, /admin, /principal, or /teacher
    const url = new URL(page.url());
    const validPaths = ['/dashboard', '/admin', '/principal', '/teacher'];
    const onValid = validPaths.some(p => url.pathname.startsWith(p));
    expect(onValid).toBe(true);
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'wrong@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
    // Should stay on login or show error — not redirect to dashboard
    await page.waitForTimeout(2_000);
    const onLogin = page.url().includes('/login');
    const hasError = await page.locator('text=/invalid|incorrect|wrong|error/i').count();
    expect(onLogin || hasError > 0).toBe(true);
  });
});
