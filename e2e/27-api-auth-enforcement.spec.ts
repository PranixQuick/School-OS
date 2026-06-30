import { test, expect } from '@playwright/test';

// EXEC-02 / P5-01 — generated from api_inventory.json. Mirrors the API-layer security assertion
// proven in 09-role-routing and certifies the SEC-W0-14 route guards (#248-#252): protected
// endpoints must reject unauthenticated requests with 401/403 — never 200 with data. The
// `request` fixture sends no session cookie, so every call here is unauthenticated.
//
// NOTE: list only CANONICAL collection endpoints that exist as app/api/**/route.ts. The students
// collection API is /api/students (there is no /api/admin/students/route.ts — only subroutes
// /api/admin/students/[id], /bulk-enable-login, /lifecycle).
const PROTECTED_ENDPOINTS = [
  '/api/students',
  '/api/admin/fees',
  '/api/admin/staff',
  '/api/admin/audit-log',
  '/api/admin/payroll/runs',
  '/api/admin/role-permissions',
  '/api/admin/transfer-certificates',
  '/api/analytics/summary',
  '/api/admin/scholarships',
  '/api/settings',
  '/api/dashboard/summary',
  '/api/risk/detect',
  '/api/dispatch',
  '/api/admin/stats',
];

test.describe('API auth enforcement (EXEC-02 / P5-01)', () => {
  for (const ep of PROTECTED_ENDPOINTS) {
    test(`unauthenticated GET ${ep} is rejected (401/403)`, async ({ request }) => {
      const res = await request.get(ep);
      expect([401, 403], `${ep} returned ${res.status()} unauthenticated`).toContain(res.status());
    });
  }
});
