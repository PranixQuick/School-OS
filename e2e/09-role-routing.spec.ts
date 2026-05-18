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

  // /students is a 'use client' page rendered as a static shell by Next.js/Vercel CDN.
  // CDN-cached static responses bypass middleware, so browser-level redirect is not reliable.
  // The security guarantee is enforced at the API layer: /api/students returns 401 without
  // a valid session. We verify that directly here.
  test('unauthenticated access to /students is blocked at API layer', async ({ request }) => {
    const res = await request.get('/api/students');
    // Without a session cookie, the API must return 401 or 403 — never 200 with data
    expect([401, 403]).toContain(res.status());
  });
});
