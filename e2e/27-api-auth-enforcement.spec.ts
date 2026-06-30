import { test, expect } from '@playwright/test';

// P5-01 (endpoints verified against the real app/api tree @ main).
// Mirrors the API-layer security assertion proven in 09-role-routing: protected endpoints must
// reject unauthenticated requests with 401/403 — never 200 with data. Uses the `request` fixture
// with no session cookie, so every call is unauthenticated.
const PROTECTED_ENDPOINTS = [
  '/api/students',
  '/api/admin/fees',
  '/api/admin/staff',
  '/api/admin/audit-log',
  '/api/admin/payroll/runs',
  '/api/admin/role-permissions',
  '/api/admin/transfer-certificates',
  '/api/admin/scholarships',
];

test.describe('API auth enforcement (P5-01)', () => {
  for (const ep of PROTECTED_ENDPOINTS) {
    test(`unauthenticated GET ${ep} is rejected (401/403)`, async ({ request }) => {
      const res = await request.get(ep);
      expect([401, 403], `${ep} returned ${res.status()} unauthenticated`).toContain(res.status());
    });
  }

  // SEC-W0-13/14 (RESOLVED): /api/analytics/summary now calls getSession and derives schoolId from
  // the session (PR #242). The forged-x-school-id class is additionally closed at the middleware
  // layer (PR #245 — strips client-supplied x-school-id/x-user-role on unauthenticated /api requests).
  // Both merged and deployed to production, so this is now an active regression guard.
  test('unauthenticated GET /api/analytics/summary is rejected (401/403) [SEC-W0-13]', async ({ request }) => {
    const res = await request.get('/api/analytics/summary');
    expect([401, 403], `/api/analytics/summary returned ${res.status()} unauthenticated`).toContain(res.status());
  });
});
