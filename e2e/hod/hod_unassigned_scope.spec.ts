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

test.describe('HOD Unassigned Scope Handling', () => {
  test('HOD with empty scope is rejected by APIs and dashboard displays No department assigned', async ({ browser }) => {
    const token = await mockSessionCookie({
      schoolId: '00000000-0000-0000-0000-000000000001',
      schoolName: 'Suchitra Academy',
      schoolSlug: 'suchitra-academy',
      plan: 'campus',
      userId: 'uuid-hod-empty',
      userEmail: 'hod.empty@edprosys.internal',
      userRole: 'hod',
      userName: 'Dr. Empty',
      hod_scope: [] // empty scope
    });

    const context = await browser.newContext();
    await context.addCookies([{
      name: 'school_session',
      value: token,
      domain: new URL(BASE).hostname,
      path: '/'
    }]);

    // 1. API request should return 403 because requireHodSession throws
    const deptRes = await context.request.get(`${BASE}/api/hod/departments`);
    expect(deptRes.status()).toBe(403);

    // 2. Navigation to HOD dashboard page should render "No department assigned"
    const page = await context.newPage();
    await page.goto(`${BASE}/hod`);
    await page.waitForLoadState('networkidle');
    
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('No department assigned. Contact admin.');

    await context.close();
  });
});
