import { test, expect, type Page } from '@playwright/test';
import {
  loginAsOwner, loginAsPrincipal, loginAsAccountant,
  loginAsCounsellor, loginAsDeo, loginAsMeo,
} from './helpers/auth';

// EXEC-02 / Phase B+C — stakeholder identity + portal certification. Each role is logged in via the
// E2E bypass (mints a session for the seeded active school_users email — no per-role password), then
// must reach its portal route without being bounced to /login. Certifies identity manufacturing +
// role routing for 6 staff stakeholders (admin + teacher are covered by specs 26 + 29).
const CASES: { name: string; login: (p: Page) => Promise<void>; route: string }[] = [
  { name: 'owner', login: loginAsOwner, route: '/owner' },
  { name: 'principal', login: loginAsPrincipal, route: '/principal' },
  { name: 'accountant', login: loginAsAccountant, route: '/accountant' },
  { name: 'counsellor', login: loginAsCounsellor, route: '/counsellor' },
  { name: 'deo', login: loginAsDeo, route: '/deo/dashboard' },
  { name: 'meo', login: loginAsMeo, route: '/meo/dashboard' },
];

test.describe('Stakeholder portal smoke (EXEC-02 / Phase B+C)', () => {
  for (const c of CASES) {
    test(`${c.name} logs in and reaches ${c.route}`, async ({ page }) => {
      await c.login(page); // identity minted via bypass; loginAs throws if login fails
      expect(page.url(), `${c.name} stuck on /login after login`).not.toContain('/login');
      await page.goto(c.route);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url(), `${c.name} bounced from ${c.route} to /login`).not.toContain('/login');
    });
  }
});
