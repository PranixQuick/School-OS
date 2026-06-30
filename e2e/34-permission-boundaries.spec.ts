import { test, expect, type Page } from '@playwright/test';
import {
  loginAsTeacher, loginAsLibrarian, loginAsHostelAdmin, loginAsPlacement, loginAsTransport,
  loginAsHod, loginAsDeo, loginAsMeo, loginAsAccountant, loginAsParent, loginAsStudent, loginAsVendor,
} from './helpers/auth';

// EXEC-02 Phase 2 — permission boundary (forbidden-action) certification.
// requireAdminSession (lib/admin-auth) admits only {owner, principal, admin_staff, admin, accountant
// (fee-domain only), viewer, counsellor}. Every other school role -> 403. accountant is scoped to
// fee routes, so a non-fee admin endpoint -> 403. parent/student/vendor authenticate with separate
// session cookies (parent_session/student_session/vendor_session), so requireAdminSession's getSession
// finds no school_session -> 401. Therefore EVERY identity below must be DENIED (401 or 403) a
// representative non-fee admin endpoint. Positive admin access is covered by 26-admin-portal-smoke.
const FORBIDDEN: { name: string; login: (p: Page) => Promise<void> }[] = [
  { name: 'teacher', login: loginAsTeacher },
  { name: 'librarian', login: loginAsLibrarian },
  { name: 'hostel_admin', login: loginAsHostelAdmin },
  { name: 'placement_officer', login: loginAsPlacement },
  { name: 'transport_staff', login: loginAsTransport },
  { name: 'hod', login: loginAsHod },
  { name: 'deo', login: loginAsDeo },
  { name: 'meo', login: loginAsMeo },
  { name: 'accountant', login: loginAsAccountant }, // fee-scoped: /api/admin/staff is out of scope
  { name: 'parent', login: loginAsParent },
  { name: 'student', login: loginAsStudent },
  { name: 'vendor', login: loginAsVendor },
];

test.describe('Permission boundaries — admin endpoint denial (EXEC-02 / Phase 2)', () => {
  for (const f of FORBIDDEN) {
    test(`${f.name} is denied GET /api/admin/staff (401/403)`, async ({ page }) => {
      await f.login(page);
      const res = await page.request.get('/api/admin/staff');
      expect([401, 403], `${f.name} got ${res.status()} on /api/admin/staff (expected denial)`).toContain(res.status());
    });
  }
});
