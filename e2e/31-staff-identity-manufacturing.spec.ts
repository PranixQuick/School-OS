import { test, expect, type Page } from '@playwright/test';
import {
  loginAsLibrarian, loginAsHostelAdmin, loginAsPlacement, loginAsTransport, loginAsHod,
} from './helpers/auth';

// EXEC-02 Phase B — staff identity manufacturing. These 5 roles are seeded as synthetic ACTIVE
// school_users on the Suchitra sandbox (roles allowed by the legacy school_users_role_check) and
// authenticated via the E2E bypass. Certified guarantee: identity logs in (off /login); roles with
// a dedicated portal page also reach it. transport_staff has no dedicated portal route (login-only).
const CASES: { name: string; login: (p: Page) => Promise<void>; route?: string }[] = [
  { name: 'librarian', login: loginAsLibrarian, route: '/librarian' },
  { name: 'hostel_admin', login: loginAsHostelAdmin, route: '/hostel-admin' },
  { name: 'placement_officer', login: loginAsPlacement, route: '/placement' },
  { name: 'hod', login: loginAsHod, route: '/hod' },
  { name: 'transport_staff', login: loginAsTransport },
];

test.describe('Staff identity manufacturing (EXEC-02 / Phase B)', () => {
  for (const c of CASES) {
    test(`${c.name} identity logs in${c.route ? ' and reaches ' + c.route : ''}`, async ({ page }) => {
      await c.login(page); // bypass mints session for the seeded role; throws if login fails
      expect(page.url(), `${c.name} stuck on /login`).not.toContain('/login');
      if (c.route) {
        await page.goto(c.route);
        await page.waitForLoadState('domcontentloaded');
        expect(page.url(), `${c.name} bounced from ${c.route} to /login`).not.toContain('/login');
      }
    });
  }
});
