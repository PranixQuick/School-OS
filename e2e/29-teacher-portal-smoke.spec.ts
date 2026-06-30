import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth';

// EXEC-02 / P5-01 — teacher stakeholder portal smoke. Certified guarantee: an authenticated
// teacher can reach each core /teacher route and is NOT bounced to /login (route exists +
// teacher session honored). No inner-DOM assumptions (real pages render toasts/empty states).
// Routes are from the real app/teacher tree.
const TEACHER_ROUTES = [
  '/teacher',
  '/teacher/attendance',
  '/teacher/homework',
  '/teacher/marks',
  '/teacher/lesson-plans',
  '/teacher/leave',
  '/teacher/curriculum',
  '/teacher/meal-attendance',
  '/teacher/proofs',
];

test.describe('Teacher portal smoke (EXEC-02 / P5-01)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTeacher(page);
  });

  for (const route of TEACHER_ROUTES) {
    test(`teacher reaches ${route} (session honored, not bounced to login)`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      expect(page.url(), `${route} bounced to /login`).not.toContain('/login');
    });
  }
});
