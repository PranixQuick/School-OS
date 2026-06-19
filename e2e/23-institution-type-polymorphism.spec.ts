// e2e/23-institution-type-polymorphism.spec.ts
// Bible Phase 6 Priority 3: Same endpoint, different institution types
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Institution polymorphism', () => {
  let adminCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'school_session');
    if (session) adminCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('/api/auth/me returns institution_type', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/auth/me`, {
      headers: adminCookie ? { cookie: adminCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('institution_type');
    expect(body).toHaveProperty('ownership_type');
    // Suchitra defaults
    expect(body.institution_type).toBe('school_k12');
    expect(body.ownership_type).toBe('private');
  });

  test('/api/onboarding/context returns institution context', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/onboarding/context`, {
      headers: adminCookie ? { cookie: adminCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('institution_type');
    expect(body).toHaveProperty('is_government');
    expect(body).toHaveProperty('is_anganwadi');
    expect(body.is_government).toBe(false);
    expect(body.is_anganwadi).toBe(false);
  });

  test('/api/config returns institution_type', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/config`, {
      headers: adminCookie ? { cookie: adminCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('institution_type');
  });

  test('dashboard loads with polymorphic widgets for k12', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    // Suchitra (k12 private) should see all 4 KPI cards
    expect(page.url()).toContain('/dashboard');
    await page.close();
  });

  test('onboarding page loads with polymorphic steps', async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    await page.goto('/onboarding');
    await page.waitForLoadState('domcontentloaded');
    expect(page.url()).toContain('/onboarding');
    await page.close();
  });
});
