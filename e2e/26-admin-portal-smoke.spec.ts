import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// P5-01 (routes verified against the real app/admin tree @ main).
// Fidelity matches 09-role-routing: an authenticated admin can open each real /admin route
// without being bounced to /login and without landing on an error route. We deliberately do NOT
// assert on DOM error elements — these pages are client-rendered shells whose toast/alert
// containers ([role="alert"]) are always present, so a DOM-count check produces false failures.
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
      // Authenticated admin must not be bounced back to login.
      expect(page.url(), `${route} bounced to /login`).not.toContain('/login');
      // Must not land on an error route.
      expect(page.url(), `${route} hit an error route`).not.toContain('error');
    });
  }
});
