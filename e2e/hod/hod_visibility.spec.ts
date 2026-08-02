import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const BASE = process.env.TEST_BASE_URL || 'https://www.edprosys.com';
const SESSION_SECRET = process.env.SESSION_SECRET || 'placeholder_session_secret_32chars_min';

async function mockSessionCookie(session: any) {
  const secret = new TextEncoder().encode(SESSION_SECRET);
  return await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('school-os')
    .setIssuedAt()
    .setSubject(session.userId)
    .setExpirationTime('1h')
    .sign(secret);
}

test.describe('HOD Visibility and Access Scope', () => {
  test('HOD-Science sees Science-only rows and is blocked from Admin endpoints', async ({ browser }) => {
    const token = await mockSessionCookie({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Suchitra Academy',
      schoolSlug: 'suchitra-academy',
      plan: 'campus',
      userId: 'uuid-hod-science',
      userEmail: 'hod.science@edprosys.internal',
      userRole: 'hod',
      userName: 'Dr. Science',
      hod_scope: [
        { school_id: '00000000-0000-0000-0000-000000000001', department: 'science' }
      ]
    });

    const context = await browser.newContext();
    await context.addCookies([{
      name: 'school_session',
      value: token,
      domain: new URL(BASE).hostname,
      path: '/'
    }]);

    // 1. Attempts to fetch HOD departments — should only return science
    const deptRes = await context.request.get(`${BASE}/api/hod/departments`);
    expect(deptRes.status()).toBe(200);
    const deptsBody = await deptRes.json();
    const depts = deptsBody.departments ?? [];
    depts.forEach((d: any) => {
      expect(d.name.toLowerCase()).toBe('science');
    });

    // 2. Attempts to fetch staff (filter naturally excludes other depts)
    const staffRes = await context.request.get(`${BASE}/api/hod/staff?dept=commerce`);
    expect(staffRes.status()).toBe(200);
    const staffBody = await staffRes.json();
    const staff = staffBody.staff ?? [];
    staff.forEach((s: any) => {
      expect(s.department.toLowerCase()).toBe('science');
    });

    // 3. Attempts to fetch /api/admin/staff directly -> should return 401/403
    const adminStaffRes = await context.request.get(`${BASE}/api/admin/staff`);
    expect([401, 403]).toContain(adminStaffRes.status());

    await context.close();
  });
});
