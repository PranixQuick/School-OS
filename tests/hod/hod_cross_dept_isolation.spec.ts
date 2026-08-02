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

test.describe('HOD Cross-Department Isolation', () => {
  test('HOD-Commerce cannot see Science data in the same college', async ({ browser }) => {
    const token = await mockSessionCookie({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Suchitra Academy',
      schoolSlug: 'suchitra-academy',
      plan: 'campus',
      userId: 'uuid-hod-commerce',
      userEmail: 'hod.commerce@edprosys.internal',
      userRole: 'hod',
      userName: 'Dr. Commerce',
      hod_scope: [
        { school_id: '00000000-0000-0000-0000-000000000001', department: 'commerce' }
      ]
    });

    const context = await browser.newContext();
    await context.addCookies([{
      name: 'school_session',
      value: token,
      domain: new URL(BASE).hostname,
      path: '/'
    }]);

    // 1. Fetch HOD staff — should only return commerce, never science
    const staffRes = await context.request.get(`${BASE}/api/hod/staff`);
    expect(staffRes.status()).toBe(200);
    const staffBody = await staffRes.json();
    const staff = staffBody.staff ?? [];
    staff.forEach((s: any) => {
      expect(s.department.toLowerCase()).not.toBe('science');
      expect(s.department.toLowerCase()).toBe('commerce');
    });

    // 2. Fetch HOD departments — should only return commerce, never science
    const deptRes = await context.request.get(`${BASE}/api/hod/departments`);
    expect(deptRes.status()).toBe(200);
    const deptsBody = await deptRes.json();
    const depts = deptsBody.departments ?? [];
    depts.forEach((d: any) => {
      expect(d.name.toLowerCase()).not.toBe('science');
      expect(d.name.toLowerCase()).toBe('commerce');
    });

    await context.close();
  });
});
