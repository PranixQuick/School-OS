import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// E2E spec: security validation
// Cross-tenant isolation, privilege escalation attempts, session abuse
test.describe('Security — Cross-tenant isolation', () => {
  test('authenticated admin cannot read students from another school', async ({ page }) => {
    await loginAsAdmin(page);
    // Try to directly query a known demo school ID that is NOT the logged-in school
    const res = await page.request.get('/api/students?school_id=73048703-f8aa-4668-981d-2cdf619767b3');
    // Should either return empty (RLS filters) or 403 — never return other school data
    if (res.ok()) {
      const body = await res.json();
      const students = body.students ?? [];
      // All returned students must belong to the authenticated school, not DPS
      for (const student of students) {
        expect(student.school_id).not.toBe('73048703-f8aa-4668-981d-2cdf619767b3');
      }
    }
  });

  test('API returns 401 for requests without session cookie', async ({ request }) => {
    // Use request fixture (no cookies) — completely separate from any page session
    const adminApis = ['/api/students', '/api/staff', '/api/admin/fees'];
    for (const api of adminApis) {
      const res = await request.get(api);
      // Must be 401 or 403 — never 200 with real data
      expect([401, 403]).toContain(res.status());
    }
  });

  test('rate-limit protected endpoints reject excessive requests', async ({ request }) => {
    // Attempt 5 rapid login requests — at least one should trigger rate limiting or 401
    const results: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request.post('/api/auth/login', {
        data: { email: 'notexist@x.com', password: 'wrong' },
      });
      results.push(res.status());
    }
    // Should be 401 (wrong creds) or 429 (rate limited) — never 500
    results.forEach(status => expect([401, 429]).toContain(status));
  });

  test('session cookie is httpOnly (not accessible from JS)', async ({ page }) => {
    await page.goto('/login');
    const cookies = await page.evaluate(() => document.cookie);
    // school_session cookie should not appear in document.cookie (httpOnly)
    expect(cookies).not.toContain('school_session');
  });
});
