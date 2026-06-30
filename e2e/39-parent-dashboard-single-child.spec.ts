import { test, expect } from '@playwright/test';
import { loginAsParent } from './helpers/auth';

// DASH-01 regression guard.
// A legacy single-child parent is a `parents` row with NO `parent_students` rows (the seeded
// sandbox parent, phone 9999900001, is exactly this shape). Before the fix, parent/dashboard did
//   const studentIds = links?.map(l => l.student_id) ?? [session.studentId];
// but a successful query with no rows returns `[]` (not nullish), so the `?? [session.studentId]`
// fallback never fired → `.in('id', [])` → 0 students → 404 "Student not found". This test fails on
// the unfixed code (404) and passes once the fallback handles the empty-array case.
test.describe('Parent dashboard — single-child fallback (DASH-01)', () => {
  test('legacy single-child parent loads dashboard (200, child present)', async ({ page }) => {
    await loginAsParent(page);
    const res = await page.request.get('/api/parent/dashboard');
    expect(res.status(), `dashboard should be 200 for a single-child parent (got ${res.status()})`).toBe(200);
    const body = await res.json();
    expect(body?.student?.name, 'dashboard should include the primary student').toBeTruthy();
    expect(body?.active_child_id, 'dashboard should resolve an active child id').toBeTruthy();
  });
});
