// e2e/07-cross-tenant-isolation.spec.ts
// Phase D — D1: Cross-tenant data isolation test.
// Verifies that a session authenticated to School B cannot access School A's data.
// MUST PASS before any pilot school is onboarded.
// PDF spec: items D1 per forensic audit issue #15.

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// Suchitra Academy (School A — seed school)
const SUCHITRA_ADMIN_EMAIL = 'admin@suchitracademy.edu.in';
const SUCHITRA_ADMIN_PASS  = 'schoolos0000';
const SUCHITRA_SCHOOL_ID   = '00000000-0000-0000-0000-000000000001';
const SUCHITRA_STUDENT_ID  = '00000000-0000-0000-0000-000000000020'; // Arjun Reddy

// DPS Nadergul (School B — separate school)
const DPS_ADMIN_EMAIL = 'sushruth@dpsnadergul.com';
const DPS_ADMIN_PASS  = 'schoolos7304';
const DPS_SCHOOL_ID   = '73048703-f8aa-4668-981d-2cdf619767b3';

// Suchitra parent credentials
const SUCHITRA_PARENT_PHONE = '+919100000101';
const SUCHITRA_PARENT_PIN   = '4532';

// Helper: log in and return cookie header for API calls
async function getAdminCookies(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  email: string,
  password: string
): Promise<string> {
  const bypassSecret = process.env.E2E_BYPASS_SECRET ?? '';
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
    headers: bypassSecret ? { 'x-e2e-bypass': bypassSecret } : {},
  });
  const setCookie = res.headers()['set-cookie'] ?? '';
  // Extract the session cookie name=value pair
  const match = setCookie.match(/school_session=[^;]+/);
  return match ? match[0] : '';
}

test.describe('Cross-tenant data isolation', () => {

  // Test 1: Suchitra admin can read their own students
  test('Suchitra admin can list own students', async ({ request }) => {
    const cookie = await getAdminCookies(request, SUCHITRA_ADMIN_EMAIL, SUCHITRA_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/admin/students`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);

    const body = await res.json() as { students?: { id: string }[] };
    const studentIds = (body.students ?? []).map((s: { id: string }) => s.id);

    // Suchitra student should be visible
    expect(studentIds).toContain(SUCHITRA_STUDENT_ID);

    // All returned students must belong to Suchitra school
    const allSuchitra = (body.students ?? []).every(
      (s: { school_id?: string }) => !s.school_id || s.school_id === SUCHITRA_SCHOOL_ID
    );
    expect(allSuchitra).toBe(true);
  });

  // Test 2: DPS admin CANNOT access Suchitra student by direct ID
  test('DPS admin cannot read Suchitra student data', async ({ request }) => {
    const cookie = await getAdminCookies(request, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/admin/students?id=${SUCHITRA_STUDENT_ID}`, {
      headers: { Cookie: cookie },
    });

    // Must be 403, 404, or empty — never 200 with Suchitra data
    if (res.status() === 200) {
      const body = await res.json() as { students?: { school_id?: string }[]; school_id?: string };
      // If 200, the returned data must NOT contain the Suchitra student
      const students = body.students ?? [];
      const leaksSuchitra = students.some(
        (s: { school_id?: string; id?: string }) =>
          s.id === SUCHITRA_STUDENT_ID || s.school_id === SUCHITRA_SCHOOL_ID
      );
      expect(leaksSuchitra).toBe(false);
    } else {
      // 403 or 404 are both acceptable — data not accessible
      expect([403, 404]).toContain(res.status());
    }
  });

  // Test 3: DPS admin's student list contains only DPS students (not Suchitra)
  test('DPS admin student list contains no Suchitra students', async ({ request }) => {
    const cookie = await getAdminCookies(request, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/admin/students`, {
      headers: { Cookie: cookie },
    });

    if (res.status() === 200) {
      const body = await res.json() as { students?: { school_id?: string }[] };
      const leaksSuchitra = (body.students ?? []).some(
        (s: { school_id?: string }) => s.school_id === SUCHITRA_SCHOOL_ID
      );
      expect(leaksSuchitra).toBe(false);
    } else {
      // 200 or empty is fine — but never Suchitra data
      expect([200, 403, 404]).toContain(res.status());
    }
  });

  // Test 4: Parent login scoped to own school — cannot access cross-school data
  test('Suchitra parent login resolves to Suchitra school only', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/parent/login`, {
      data: { phone: SUCHITRA_PARENT_PHONE, pin: SUCHITRA_PARENT_PIN },
    });
    expect(res.status()).toBe(200);

    const body = await res.json() as {
      parent?: { school_id?: string };
      student?: { school_id?: string };
    };

    // Parent and student must be from Suchitra — never DPS
    expect(body.parent?.school_id).toBe(SUCHITRA_SCHOOL_ID);
    expect(body.student?.school_id ?? SUCHITRA_SCHOOL_ID).toBe(SUCHITRA_SCHOOL_ID);

    // Must NOT be from DPS school
    expect(body.parent?.school_id).not.toBe(DPS_SCHOOL_ID);
  });

});
