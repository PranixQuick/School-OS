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

  // Phase 0.6 — this test could not fail.
  //
  // It asserted `expect(page.url()).not.toContain('error')`. No route in this
  // app puts the string "error" in its URL, so the assertion held whatever
  // happened: if the admin was correctly bounced, it passed; if the admin was
  // handed the full parent portal — the exact leak the test is named after —
  // it also passed. The test name claimed a security property the body never
  // checked.
  //
  // The real property: an admin session must not be served parent-portal data.
  // Either the admin is redirected away from /parent, or /parent renders its
  // own login — but it must never render a parent's children, fees or
  // attendance to an admin session. Asserted at the API layer too, because
  // /parent is a client-rendered page and the CDN can serve its shell.
  test('admin session is not served the parent portal', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/parent');
    await page.waitForLoadState('domcontentloaded');

    const landedOn = new URL(page.url()).pathname;
    const stayedOnParentPortal = landedOn === '/parent';

    if (stayedOnParentPortal) {
      // If we were not redirected, the page must be a login prompt, not a
      // populated dashboard.
      await expect(
        page.locator('input[type="password"], input[type="tel"], input[name="phone"]').first(),
        'an admin session was left on /parent with no login prompt — parent portal content may be exposed'
      ).toBeVisible({ timeout: 10_000 });
    }

    // The authoritative check: the parent data API must refuse this session.
    const res = await page.request.get('/api/parent/children');
    expect(
      res.status(),
      `/api/parent/children answered ${res.status()} to an admin session`
    ).toBeGreaterThanOrEqual(400);
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
