// e2e/helpers/auth.ts
// Shared auth helpers for Playwright tests.

import type { Page } from '@playwright/test';

export const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL    ?? 'admin@suchitracademy.edu.in';
export const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? 'schoolos0000';
export const BASE_URL       = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Login")');
  // Wait for redirect away from /login
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10_000 });
}

export async function expectNoErrors(page: Page) {
  const errorText = await page.locator('[data-testid="error"], .error-message, [role="alert"]').count();
  // Not a hard failure — just returns count for callers to assert on
  return errorText;
}
