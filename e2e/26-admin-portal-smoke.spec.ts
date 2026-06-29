import { test, expect } from '@playwright/test';
import { loginAsAdmin, expectNoErrors } from './helpers/auth';

// P5-01 (generated from Digital Twin route_inventory.json @ tree_sha 49126cf).
// Fidelity matches 09-role-routing: an authenticated admin can open each real /admin route
// without being bounced to /login and without an error surface. No inner-DOM assumptions.
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

test.describe('Admin portal smoke (P5-01)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const route of ADMIN_ROUTES) {
    test(`admin opens ${route} without error or logout`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      // Must not be redirected back to login.
      expect(page.url(), `${route} bounced to /login`).not.toContain('/login');
      // No visible error surface.
      const errorCount = await expectNoErrors(page);
      expect(errorCount, `${route} rendered an error surface`).toBe(0);
    });
  }
});
