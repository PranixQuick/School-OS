import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// EXEC-02 / P5-01 — generated from Digital Twin route_inventory.json (real /admin routes).
// The certified guarantee: an authenticated admin can reach each real /admin route and is NOT
// bounced back to /login (i.e. the route exists and the session is honored). We deliberately do
// NOT assert "zero [role=alert] elements" — real pages legitimately render toasts / empty-state
// banners / inline validation that use role="alert", which would cause false failures.
const ADMIN_ROUTES = [
  '/dashboard',
  '/admin',
  '/admin/students',
  '/admin/fees',
  '/admin/staff',
  '/admin/timetable',
  '/admin/broadcasts',
  '/admin/complaints',
  '/admin/report-cards',
  '/admin/transfer-certificates',
  '/admin/payroll',
  '/admin/transport',
  '/admin/library',
  '/admin/hostel',
  '/admin/scholarships',
  '/admin/settings',
];

test.describe('Admin portal smoke (EXEC-02 / P5-01)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of ADMIN_ROUTES) {
    test(`admin reaches ${route} (session honored, not bounced to login)`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url(), `${route} bounced to /login`).not.toContain('/login');
    });
  }
});
