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
  test('GET /offline.html — retry button visible', async ({ page }) => {
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
  test('GET /parent/login — 200 (own auth flow)', async ({ page }) => {
    const res = await page.goto(`${BASE}/parent/login`);
    expect(res?.status()).toBe(200);
  });
});

// ── Auth redirect guards — main /login ───────────────────────
const REDIRECTS_TO_MAIN_LOGIN = [
  '/dashboard', '/teacher', '/principal', '/owner',
  '/admin/payroll', '/admin/events', '/admin/staff', '/settings',
];
test.describe('Auth guards — main login redirect', () => {
  for (const route of REDIRECTS_TO_MAIN_LOGIN) {
    test(`${route} → /login when unauthenticated`, async ({ page }) => {
      await page.goto(`${BASE}${route}`, { waitUntil: 'commit' });
      expect(page.url()).toMatch(/login/i);
    });
  }
});

// ── Role-specific auth flows (own portals) ────────────────────
test.describe('Auth guards — role-specific flows', () => {
  test('/parent — not 404 (own portal or redirect to /parent/login)', async ({ page }) => {
    const res = await page.goto(`${BASE}/parent`, { waitUntil: 'commit' });
    expect(res?.status()).not.toBe(404);
    expect(page.url()).not.toContain('/404');
  });
  test('/students — not 404', async ({ page }) => {
    await page.goto(`${BASE}/students`, { waitUntil: 'commit' });
    expect(page.url()).not.toContain('/404');
  });
});

// ── Ghost route redirect ──────────────────────────────────────
test.describe('Route redirects', () => {
  test('/teacher/checkin → /teacher/check-in (canonical)', async ({ page }) => {
    await page.goto(`${BASE}/teacher/checkin`, { waitUntil: 'commit' });
    // Should redirect to login (auth required), but NOT to /teacher/checkin
    expect(page.url()).not.toContain('/checkin');
  });
});

// ── API tenant isolation ──────────────────────────────────────
test.describe('API tenant isolation — unauthenticated 401/403', () => {
  test('GET /api/admin/staff — no auth = 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/staff`);
    expect([401, 403]).toContain(res.status());
  });
  test('GET /api/admin/fees — no auth = 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/fees`);
    expect([401, 403]).toContain(res.status());
  });
  test('GET /api/admin/payroll/runs — no auth = 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/payroll/runs`);
    expect([401, 403]).toContain(res.status());
  });
  test('GET /api/admin/events/galleries — no auth = 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/events/galleries`);
    expect([401, 403]).toContain(res.status());
  });
  test('GET /api/teacher/attendance — no auth = 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/teacher/attendance?class_id=test&date=2026-05-01`);
    expect([401, 403]).toContain(res.status());
  });
  test('GET /api/parent/events — no auth = 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/parent/events`);
    expect([401, 403]).toContain(res.status());
  });
  // Cross-tenant attempt: try to access a known resource with no session
  test('POST /api/admin/payroll/runs with no session — 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/payroll/runs`, {
      data: { pay_period_month: 5, pay_period_year: 2026 },
    });
    expect([401, 403]).toContain(res.status());
  });
});

// ── API health ────────────────────────────────────────────────
test.describe('API health', () => {
  test('GET /api/health — healthy with db ok', async ({ request }) => {
    const res = await request.get(`${BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(body.checks.db.ok).toBe(true);
  });
  test('GET /api/auth/me — 401 without session', async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/me`);
    expect([401, 403]).toContain(res.status());
  });
});

// ── PWA manifest ──────────────────────────────────────────────
test.describe('PWA manifest', () => {
  test('manifest.json — valid with required fields, shortcuts, standalone', async ({ request }) => {
    const res = await request.get(`${BASE}/manifest.json`);
    expect(res.status()).toBe(200);
    const m = await res.json();
    expect(m.name).toBe('EdProSys');
    expect(m.display).toBe('standalone');
    expect(m.id).toBeTruthy(); // Chrome PWA identity field
    expect(Array.isArray(m.icons)).toBe(true);
    expect(m.icons.length).toBeGreaterThan(0);
    expect(Array.isArray(m.shortcuts)).toBe(true); // language/attendance shortcuts
    expect(m.theme_color).toBe('#4F46E5');
  });
});

// ── Route existence (no 404s) ─────────────────────────────────
test.describe('Route existence — no 404s', () => {
  const MUST_EXIST = [
    '/login', '/register', '/privacy', '/terms', '/offline.html', '/parent/login',
  ];
  for (const route of MUST_EXIST) {
    test(`${route} is not 404`, async ({ page }) => {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: 'commit' });
      expect(res?.status()).not.toBe(404);
    });
  }
});

// ── Mobile viewport ───────────────────────────────────────────
test.describe('Mobile viewport — no horizontal overflow', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('Landing page on mobile — no horizontal scroll', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 2);
  });
  test('/privacy on mobile — readable', async ({ page }) => {
    await page.goto(`${BASE}/privacy`);
    await expect(page.locator('h1')).toBeVisible();
    const bw = await page.evaluate(() => document.body.scrollWidth);
    const ww = await page.evaluate(() => window.innerWidth);
    expect(bw).toBeLessThanOrEqual(ww + 2);
  });
  test('/login on mobile — 200', async ({ page }) => {
    const res = await page.goto(`${BASE}/login`);
    expect(res?.status()).toBe(200);
  });
});
