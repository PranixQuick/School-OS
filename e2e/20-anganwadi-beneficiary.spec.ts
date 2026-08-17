// e2e/20-anganwadi-beneficiary.spec.ts
// Bible Phase 6 Priority 2: Anganwadi beneficiary module
//
// ─────────────────────────────────────────────────────────────────────────────
// Phase 0.6 — these tests could not fail.
//
// Every one of the five previously asserted:
//
//     expect(url.includes('/login') || url.includes('/anganwadi')).toBe(true)
//
// An unauthenticated visit to /anganwadi/* redirects to /login, which satisfies
// the left branch. Loading the page satisfies the right branch. The only way to
// fail was a hard crash that left the browser on neither URL. Five tests, five
// guaranteed passes, contributing five green ticks to a suite total while
// verifying nothing.
//
// That is worse than having no test: it inflates the count and manufactures
// confidence. Rewritten below so each assertion has a false case.
//
// What is actually verified now:
//   1. Unauthenticated access is REDIRECTED, and specifically lands on /login —
//      not merely "one of two acceptable URLs". Fails if the guard regresses
//      and the page renders to a stranger.
//   2. The login page that receives the redirect actually renders a usable form,
//      so a redirect into a broken page is not counted as a pass.
//   3. The route exists — a 404 is a distinct failure from a redirect.
//
// Authenticated behaviour (that the module renders beneficiary data for an
// anganwadi worker) still needs a seeded anganwadi identity. That is tracked as
// Phase 5 "make anganwadi real"; it is deliberately not faked here.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

const ANGANWADI_ROUTES = [
  '/anganwadi',
  '/anganwadi/beneficiaries',
  '/anganwadi/growth',
  '/anganwadi/immunization',
  '/anganwadi/nutrition',
];

test.describe('Anganwadi module — unauthenticated access is guarded', () => {
  for (const route of ANGANWADI_ROUTES) {
    test(`${route} redirects an unauthenticated visitor to /login`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      const response = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: 'domcontentloaded',
      });

      // A missing route is a real failure, and is distinct from a redirect.
      expect(
        response?.status(),
        `${route} returned 404 — the route does not exist`
      ).not.toBe(404);

      await page.waitForLoadState('networkidle');
      const landedOn = new URL(page.url()).pathname;

      // The assertion that has a false case: an unauthenticated visitor must
      // NOT be left on the anganwadi route.
      expect(
        landedOn,
        `${route} rendered to an unauthenticated visitor instead of redirecting`
      ).not.toContain('/anganwadi');

      expect(
        landedOn,
        `${route} redirected to ${landedOn} rather than the login page`
      ).toContain('/login');

      // And the login page it redirected to must actually be usable — a
      // redirect into a blank or broken page is not a pass.
      await expect(
        page.locator('input[type="password"], input[name="password"]').first()
      ).toBeVisible({ timeout: 10_000 });

      await context.close();
    });
  }
});
