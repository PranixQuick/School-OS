// e2e/helpers/auth.ts
import type { Page } from '@playwright/test';

// GitHub Actions sets unset secrets to empty string "".
// Use || (not ??) so empty strings also fall back to the correct demo credentials.
// Fallback credentials match seeded demo data for Suchitra Academy.
// Real CI should set all secrets explicitly; these fallbacks enable local dev runs.
export const ADMIN_EMAIL      = process.env.TEST_ADMIN_EMAIL      || 'admin@suchitracademy.edu.in';
export const ADMIN_PASSWORD   = process.env.TEST_ADMIN_PASSWORD   || 'schoolos0000';
export const TEACHER_EMAIL    = process.env.TEST_TEACHER_EMAIL    || 'test.teacher@schoolos.local';
export const TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD || 'schoolos0000';
export const BASE_URL         = process.env.PLAYWRIGHT_BASE_URL   || 'https://www.schoolos.in';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15_000 });
  await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 5_000 });

  const bypassSecret = process.env.E2E_BYPASS_SECRET || '';
  if (bypassSecret) {
    await page.route('**/api/auth/login', async (route) => {
      const request = route.request();
      await route.continue({
        headers: { ...request.headers(), 'x-e2e-bypass': bypassSecret },
      });
    });
  }

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  const [response] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      { timeout: 15_000 }
    ),
    page.click('button[type="submit"]'),
  ]);

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10_000 });
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function loginAsTeacher(page: Page) {
  await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
}

export async function expectNoErrors(page: Page) {
  return page.locator('[data-testid="error"], .error-message, [role="alert"]').count();
}
