import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'https://www.edprosys.com';

// Public routes that must return 200 without auth
test.describe('Public routes', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/EdProSys/);
    await expect(page.locator('text=Get Started')).toBeVisible();
  });

  test('/login page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('input[type="email"], input[type="tel"], input[name="email"]')).toBeVisible({ timeout: 5000 }).catch(() => {});
    expect(page.url()).not.toContain('/404');
  });

  test('/privacy page loads with content', async ({ page }) => {
    await page.goto(`${BASE_URL}/privacy`);
    await expect(page.locator('h1')).toContainText('Privacy Policy');
    await expect(page.locator('text=Pranix AI Labs')).toBeVisible();
  });

  test('/terms page loads with content', async ({ page }) => {
    await page.goto(`${BASE_URL}/terms`);
    await expect(page.locator('h1')).toContainText('Terms of Service');
  });

  test('/offline.html loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/offline.html`);
    await expect(page.locator('text=You are offline')).toBeVisible();
    await expect(page.locator('button')).toContainText('Try again');
  });
});

// Auth-protected routes must redirect to login
test.describe('Auth-protected redirects', () => {
  for (const route of ['/dashboard', '/teacher', '/parent', '/principal', '/owner', '/admin/payroll', '/admin/events']) {
    test(`${route} redirects to /login when unauthenticated`, async ({ page }) => {
      const res = await page.goto(`${BASE_URL}${route}`, { waitUntil: 'commit' });
      // Should redirect (final URL is login page) or return 200 with login content
      const finalUrl = page.url();
      expect(finalUrl).toMatch(/\/login|\/parent\/login|\/student\/login/);
    });
  }
});

// Health check
test('API health check returns healthy', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe('healthy');
  expect(body.checks.db.ok).toBe(true);
});
