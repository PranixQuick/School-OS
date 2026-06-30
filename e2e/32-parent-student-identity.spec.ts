import { test, expect } from '@playwright/test';
import { loginAsParent, loginAsStudent } from './helpers/auth';

// EXEC-02 Phase B — parent & student identity manufacturing. These portals use PIN auth (not the
// staff x-e2e-bypass). Seeded sandbox identities on Suchitra: a DEMO parent (phone 9999900001 / PIN
// 1234) linked to student Aadhya Sharma, and that student (admission SA-KG-001 / PIN 1234) with login
// enabled. Certified guarantee: the identity authenticates (login API returns 200 — the helper throws
// otherwise) and the resulting session is honored by a protected portal API (not 401).

test.describe('Parent & student identity manufacturing (EXEC-02 / Phase B)', () => {
  test('parent logs in (phone + PIN) and session is honored', async ({ page }) => {
    await loginAsParent(page); // throws unless /api/parent/login returns 200
    const res = await page.request.get('/api/parent/dashboard');
    expect(res.status(), 'parent API should recognize the session (not 401)').not.toBe(401);
    expect(res.status(), 'parent API should not be a server error').toBeLessThan(500);
  });

  test('student logs in (admission + PIN) and session is honored', async ({ page }) => {
    await loginAsStudent(page); // throws unless /api/student/login returns 200
    const res = await page.request.get('/api/student/profile');
    expect(res.status(), 'student API should recognize the session (not 401)').not.toBe(401);
    expect(res.status(), 'student API should not be a server error').toBeLessThan(500);
  });
});
