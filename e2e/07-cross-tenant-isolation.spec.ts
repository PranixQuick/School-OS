// e2e/07-cross-tenant-isolation.spec.ts
// Phase D — D1: Cross-tenant data isolation test.
// Verifies that a session authenticated to School B cannot access School A's data.
// MUST PASS before any pilot school is onboarded.

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://www.edprosys.com';

// Suchitra Academy (School A — seed school)
const SUCHITRA_ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@suchitracademy.edu.in';
const SUCHITRA_ADMIN_PASS  = process.env.TEST_ADMIN_PASSWORD || 'edprosys0000';
const SUCHITRA_SCHOOL_ID   = '00000000-0000-0000-0000-000000000001';
const SUCHITRA_STUDENT_ID  = '00000000-0000-0000-0000-000000000020'; // Arjun Reddy

// DPS Nadergul (School B — separate school, owner-only, no students)
const DPS_ADMIN_EMAIL = 'sushruth@dpsnadergul.com';
const DPS_ADMIN_PASS  = 'edprosys7304';
const DPS_SCHOOL_ID   = '73048703-f8aa-4668-981d-2cdf619767b3';

// Suchitra parent credentials
const SUCHITRA_PARENT_PHONE = '+919100000101';
const SUCHITRA_PARENT_PIN   = process.env.TEST_PARENT_PIN || '1234';

async function getAdminCookies(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  email: string,
  password: string
): Promise<string> {
  const bypassSecret = process.env.E2E_BYPASS_SECRET || '';
  const res = await request.post(`${BASE_URL}/api/auth/login`, {
    data: { email, password },
    headers: bypassSecret ? { 'x-e2e-bypass': bypassSecret } : {},
  });
  const setCookie = res.headers()['set-cookie'] ?? '';
  const match = setCookie.match(/school_session=[^;]+/);
  return match ? match[0] : '';
}

test.describe('Cross-tenant data isolation', () => {

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

  test('DPS admin cannot read Suchitra student data', async ({ request }) => {
    const cookie = await getAdminCookies(request, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/students?id=${SUCHITRA_STUDENT_ID}`, {
      headers: { Cookie: cookie },
    });

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

  test('DPS admin student list contains no Suchitra students', async ({ request }) => {
    const cookie = await getAdminCookies(request, DPS_ADMIN_EMAIL, DPS_ADMIN_PASS);
    expect(cookie).toBeTruthy();

    const res = await request.get(`${BASE_URL}/api/students`, {
      headers: { Cookie: cookie },
    });

    expect(res.status()).not.toBe(500);
    if (res.status() === 200) {
      const body = await res.json() as { students?: { id?: string }[] };
      const leaksSuchitra = (body.students ?? []).some(
        (s: { id?: string }) => s.id === SUCHITRA_STUDENT_ID
      );
      expect(leaksSuchitra).toBe(false);
    }
  });

  test('Suchitra parent login resolves to Suchitra school only', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/parent/login`, {
      data: { phone: SUCHITRA_PARENT_PHONE, pin: SUCHITRA_PARENT_PIN },
    });
    expect(res.status()).toBe(200);

    const body = await res.json() as {
      parent?: { school_id?: string };
    };

    expect(body.parent?.school_id).toBe(SUCHITRA_SCHOOL_ID);
    expect(body.parent?.school_id).not.toBe(DPS_SCHOOL_ID);
  });

});
