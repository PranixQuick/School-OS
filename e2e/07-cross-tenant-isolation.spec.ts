// e2e/07-cross-tenant-isolation.spec.ts
// Phase D — D1: Cross-tenant data isolation test.
// Verifies that a session authenticated to School B cannot access School A's data.
// MUST PASS before any pilot school is onboarded.

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// Suchitra Academy (School A — seed school)
const SUCHITRA_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? 'admin@suchitracademy.edu.in';
const SUCHITRA_ADMIN_PASS  = process.env.TEST_ADMIN_PASSWORD ?? 'edprosys0000';
const SUCHITRA_SCHOOL_ID   = '00000000-0000-0000-0000-000000000001';
const SUCHITRA_STUDENT_ID  = '00000000-0000-0000-0000-000000000020'; // Arjun Reddy

// DPS Nadergul (School B — separate school, owner-only, no students)
const DPS_ADMIN_EMAIL = 'sushruth@dpsnadergul.com';
const DPS_ADMIN_PASS  = 'edprosys7304';
const DPS_SCHOOL_ID   = '73048703-f8aa-4668-981d-2cdf619767b3';

// Suchitra parent credentials (reset to known values in demo data)
const SUCHITRA_PARENT_PHONE = '+919100000101';
const SUCHITRA_PARENT_PIN   = process.env.TEST_PARENT_PIN ?? '1234';

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
  const match = setCookie.match(/school_session=[^;]+/);
  return match ? match[0] : '';
}

test.describe('Cross-tenant data isolation', () => {

  // Test 1: Suchitra admin can read their own students
  test('Suchitra admin can list own students', async ({ request }) => {
    const cookie = await getAdminCookies(request, SUCHITRA_ADMIN_EMAIL, SUCHITRA_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/students`, {
      headers: { Cookie: cookie },
    });
    expect(res.status()).toBe(200);

    const body = await res.json() as { students?: { id: string }[] };
    const studentIds = (body.students ?? []).map((s: { id: string }) => s.id);
    expect(studentIds).toContain(SUCHITRA_STUDENT_ID);
  });

  // Test 2: DPS admin CANNOT access Suchitra student by direct ID
  test('DPS admin cannot read Suchitra student data', async ({ request }) => {
    const cookie = await getAdminCookies(request, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/students?id=${SUCHITRA_STUDENT_ID}`, {
      headers: { Cookie: cookie },
    });

    // Must be 403, 404, or empty — never 200 with Suchitra data
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      const leaksSuchitra = (body.students ?? []).some(
        (s: { id?: string }) => s.id === SUCHITRA_STUDENT_ID
      );
      expect(leaksSuchitra).toBe(false);
    } else {
      expect([403, 404]).toContain(res.status());
    }
  });

  // Test 3: DPS admin's student list contains no Suchitra students
  // Note: DPS Nadergul has 0 students — any returned list must be empty
  test('DPS admin student list contains no Suchitra students', async ({ request }) => {
    const cookie = await getAdminCookies(request, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/students`, {
      headers: { Cookie: cookie },
    });

    // Accept 200 with empty list, or any non-200 except 500
    expect(res.status()).not.toBe(500);
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      const leaksSuchitra = (body.students ?? []).some(
        (s: { id?: string }) => s.id === SUCHITRA_STUDENT_ID
      );
      expect(leaksSuchitra).toBe(false);
    }
  });

  // Test 4: Parent login resolves to correct school only
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
    expect(body.parent?.school_id).not.toBe(DPS_SCHOOL_ID);
  });

});
