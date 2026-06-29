import { test, expect } from '@playwright/test';

// P5-01 (generated from api_inventory.json @ tree_sha 49126cf).
// Mirrors the API-layer security assertion proven in 09-role-routing: protected endpoints must
// reject unauthenticated requests with 401/403 — never 200 with data. Uses the `request` fixture
// with no session cookie, so every call is unauthenticated.
const PROTECTED_ENDPOINTS = [
  '/api/students',
  '/api/admin/students',
  '/api/admin/fees',
  '/api/admin/staff',
  '/api/admin/audit-log',
  '/api/admin/payroll/runs',
  '/api/admin/role-permissions',
  '/api/admin/transfer-certificates',
  '/api/analytics/summary',
  '/api/admin/scholarships',
];

test.describe('API auth enforcement (P5-01)', () => {
  for (const ep of PROTECTED_ENDPOINTS) {
    test(`unauthenticated GET ${ep} is rejected (401/403)`, async ({ request }) => {
      const res = await request.get(ep);
      expect([401, 403], `${ep} returned ${res.status()} unauthenticated`).toContain(res.status());
    });
  }
});
