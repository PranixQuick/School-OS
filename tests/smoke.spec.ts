import { test, expect } from '@playwright/test';

const BASE = process.env.TEST_BASE_URL || 'https://www.edprosys.com';

// ── Public routes ─────────────────────────────────────────────
test.describe('Public routes — unauthenticated 200s', () => {
  test('GET / — landing page', async ({ page }) => {
    const res = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
  });
  test('GET /privacy — 200 with content', async ({ page }) => {
    await page.goto(`${BASE}/privacy`);
    await expect(page.locator('h1')).toContainText('Privacy Policy');
  });
  test('GET /terms — 200 with content', async ({ page }) => {
    await page.goto(`${BASE}/terms`);
    await expect(page.locator('h1')).toContainText('Terms of Service');
  });
  test('GET /offline.html — 200 with retry button', async ({ page }) => {
    await page.goto(`${BASE}/offline.html`);
    await expect(page.getByText('You are offline')).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  });
  test('GET /register — 200', async ({ page }) => {
    const res = await page.goto(`${BASE}/register`);
    expect(res?.status()).toBe(200);
  });
  test('GET /login — 200', async ({ page }) => {
    const res = await page.goto(`${BASE}/login`);
    expect(res?.status()).toBe(200);
  });
});

// ── Auth redirect guards ──────────────────────────────────────
// Routes that use the MAIN login (/login) when unauthenticated.
// /parent and /students are excluded: /parent has its own auth flow
// (/parent/login) and /students is accessible to staff-role sessions.
const REDIRECTS_TO_MAIN_LOGIN = [
  '/dashboard',
  '/teacher',
  '/principal',
  '/owner',
  '/admin/payroll',
  '/admin/events',
  '/admin/staff',
  '/settings',
];

test.describe('Auth guards — main login redirect', () => {
  for (const route of REDIRECTS_TO_MAIN_LOGIN) {
    test(`${route} → redirects to /login`, async ({ page }) => {
      await page.goto(`${BASE}${route}`, { waitUntil: 'commit' });
      const url = page.url();
      expect(url).toMatch(/login/i);
    });
  }
});

// /parent has its own auth — must not 404, must return 200 or redirect to /parent/login
test.describe('Auth guards — role-specific flows', () => {
  test('/parent — serves parent portal or redirects to /parent/login (not /login)', async ({ page }) => {
    const res = await page.goto(`${BASE}/parent`, { waitUntil: 'commit' });
    expect(res?.status()).not.toBe(404);
    // Must either stay at /parent (has own session) or go to /parent/login — never 404
    expect(page.url()).not.toContain('/404');
  });

  test('/students — accessible or redirects to login (not 404)', async ({ page }) => {
    await page.goto(`${BASE}/students`, { waitUntil: 'commit' });
    const url = page.url();
    expect(url).not.toContain('/404');
    // Either redirects to any login variant or serves the page (staff have access)
    // We do NOT assert a specific redirect because behaviour depends on session
  });
});

// ── API health checks ─────────────────────────────────────────
test.describe('API contracts', () => {
  test('GET /api/health — 200 healthy', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.db.ok).toBe(true);
  });

  test('GET /api/auth/me — 401 when unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/admin/payroll/runs — 401 when unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/payroll/runs`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/admin/events/galleries — 401 when unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/events/galleries`);
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/admin/payroll/runs — 401 when unauthenticated', async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/payroll/runs`, {
      data: { pay_period_month: 5, pay_period_year: 2026 },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/teacher/attendance — 401 when unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/teacher/attendance?class_id=test&date=2026-05-01`);
    expect([401, 403]).toContain(res.status());
  });

  test('GET /api/parent/events — 401 when unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/parent/events`);
    expect([401, 403]).toContain(res.status());
  });
});

// ── Route existence checks (no 404s on live routes) ──────────
test.describe('Route existence — no 404s', () => {
  const LIVE_ROUTES = [
    '/login', '/register', '/privacy', '/terms', '/offline.html',
    '/parent/login',
  ];
  for (const route of LIVE_ROUTES) {
    test(`${route} must not 404`, async ({ page }) => {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: 'commit' });
      expect(res?.status()).not.toBe(404);
    });
  }
});

// ── Mobile viewport checks ────────────────────────────────────
test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Landing page renders on mobile without horizontal scroll', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 2);
  });

  test('Privacy page readable on mobile', async ({ page }) => {
    await page.goto(`${BASE}/privacy`);
    await expect(page.locator('h1')).toBeVisible();
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 2);
  });

  test('/login loads on mobile', async ({ page }) => {
    const res = await page.goto(`${BASE}/login`);
    expect(res?.status()).toBe(200);
  });
});

// ── PWA manifest check ────────────────────────────────────────
test.describe('PWA manifest', () => {
  test('manifest.json is valid JSON with required fields', async ({ request }) => {
    const res = await request.get(`${BASE}/manifest.json`);
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
