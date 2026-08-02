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

test.describe('HOD Write Operations Blocked', () => {
  test('POST/PATCH/DELETE calls to HOD endpoints return 403 Forbidden', async ({ browser }) => {
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

    // Check staff writes
    const postStaff = await context.request.post(`${BASE}/api/hod/staff`, { data: {} });
    expect(postStaff.status()).toBe(403);
    const patchStaff = await context.request.patch(`${BASE}/api/hod/staff`, { data: {} });
    expect(patchStaff.status()).toBe(403);
    const deleteStaff = await context.request.delete(`${BASE}/api/hod/staff`);
    expect(deleteStaff.status()).toBe(403);

    // Check batches writes
    const postBatches = await context.request.post(`${BASE}/api/hod/batches`, { data: {} });
    expect(postBatches.status()).toBe(403);
    const patchBatches = await context.request.patch(`${BASE}/api/hod/batches`, { data: {} });
    expect(patchBatches.status()).toBe(403);
    const deleteBatches = await context.request.delete(`${BASE}/api/hod/batches`);
    expect(deleteBatches.status()).toBe(403);

    // Check departments writes
    const postDepts = await context.request.post(`${BASE}/api/hod/departments`, { data: {} });
    expect(postDepts.status()).toBe(403);
    const patchDepts = await context.request.patch(`${BASE}/api/hod/departments`, { data: {} });
    expect(patchDepts.status()).toBe(403);
    const deleteDepts = await context.request.delete(`${BASE}/api/hod/departments`);
    expect(deleteDepts.status()).toBe(403);

    await context.close();
  });
});
