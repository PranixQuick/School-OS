import { test, expect, type Page } from '@playwright/test';
import { loginAsAccountant, loginAsParent, loginAsStudent, loginAsVendor } from './helpers/auth';

// EXEC-02 Phase 2 — permission matrix expansion.
// (1) POSITIVE scope: accountant IS admitted to fee-domain admin routes (ACCOUNTANT_ROUTE_ALLOWLIST in
//     lib/authz includes /api/admin/fees), so the guard must NOT deny it (not 401/403). #262 already
//     certified accountant is denied the non-fee /api/admin/staff (403) — together these prove the
//     fee-only scoping is real.
// (2) Cross-domain: parent/student/vendor authenticate with their own session cookies, so they must be
//     denied school-session endpoints (/api/students = getSession, /api/dashboard/summary = getSession).

test.describe('Permission matrix expansion (EXEC-02 / Phase 2)', () => {
  test('accountant is admitted to /api/admin/fees (passes the guard, not 401/403)', async ({ page }) => {
    await loginAsAccountant(page);
    const res = await page.request.get('/api/admin/fees');
    expect([401, 403], `accountant unexpectedly denied /api/admin/fees (got ${res.status()})`).not.toContain(res.status());
  });

  const CROSS: { name: string; login: (p: Page) => Promise<void> }[] = [
    { name: 'parent', login: loginAsParent },
    { name: 'student', login: loginAsStudent },
    { name: 'vendor', login: loginAsVendor },
  ];
  const SCHOOL_ENDPOINTS = ['/api/students', '/api/dashboard/summary'];
  for (const c of CROSS) {
    for (const ep of SCHOOL_ENDPOINTS) {
      test(`${c.name} is denied ${ep} (401/403)`, async ({ page }) => {
        await c.login(page);
        const res = await page.request.get(ep);
        expect([401, 403], `${c.name} got ${res.status()} on ${ep} (expected denial)`).toContain(res.status());
      });
    }
  }
});
