// e2e/helpers/auth.ts
import type { Page } from '@playwright/test';

// GitHub Actions sets unset secrets to empty string "".
// Use || (not ??) so empty strings also fall back to the correct demo credentials.
// Fallback credentials match seeded demo data for Suchitra Academy.
// Real CI should set all secrets explicitly; these fallbacks enable local dev runs.
export const ADMIN_EMAIL      = process.env.TEST_ADMIN_EMAIL      || 'admin@suchitracademy.edu.in';
export const ADMIN_PASSWORD   = process.env.TEST_ADMIN_PASSWORD   || 'edprosys0000';
export const TEACHER_EMAIL    = process.env.TEST_TEACHER_EMAIL    || 'test.teacher@schoolos.local';
export const TEACHER_PASSWORD = process.env.TEST_TEACHER_PASSWORD || 'edprosys0000';
export const BASE_URL         = process.env.PLAYWRIGHT_BASE_URL   || 'https://www.edprosys.com';

// EXEC-02 Phase B (Identity Manufacturing): the login route's x-e2e-bypass path mints a session
// for ANY active school_users email without a password (see app/api/auth/login/route.ts). So in
// CI (E2E_BYPASS_SECRET set) these role logins resolve purely from the seeded demo users — no
// per-role password secret is required. Emails default to seeded ACTIVE demo accounts and can be
// overridden by TEST_<ROLE>_EMAIL secrets. The password is only used on non-bypass local runs.
const DEMO_PASSWORD          = process.env.TEST_DEMO_PASSWORD     || 'edprosys0000';
export const OWNER_EMAIL      = process.env.TEST_OWNER_EMAIL      || 'demo.owner@suchitra.edprosys.demo';
export const PRINCIPAL_EMAIL  = process.env.TEST_PRINCIPAL_EMAIL  || 'demo.principal@suchitra.edprosys.demo';
export const ACCOUNTANT_EMAIL = process.env.TEST_ACCOUNTANT_EMAIL || 'demo.accountant@suchitra.edprosys.demo';
export const COUNSELLOR_EMAIL = process.env.TEST_COUNSELLOR_EMAIL || 'demo.counsellor@suchitra.edprosys.demo';
export const DEO_EMAIL        = process.env.TEST_DEO_EMAIL        || 'demo.deo@edprosys.demo';
export const MEO_EMAIL        = process.env.TEST_MEO_EMAIL        || 'demo.meo@edprosys.demo';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');

  // The login form renders on both the chromium and mobile (Pixel 5) projects,
  // but the previous strict waitForSelector('input[type="email"]', { state:
  // 'visible' }) could time out on the mobile viewport before layout/hydration
  // settled (all observed failures were [mobile]; desktop passed). Wait for the
  // field to be attached, scroll it into view, then rely on Playwright's fill()
  // actionability auto-wait. This is resilient on both viewports and changes no
  // application behaviour.
  const emailField = page.locator('input[type="email"]');
  await emailField.waitFor({ state: 'attached', timeout: 15_000 });
  await emailField.scrollIntoViewIfNeeded();

  const bypassSecret = process.env.E2E_BYPASS_SECRET || '';
  if (bypassSecret) {
    await page.route('**/api/auth/login', async (route) => {
      const request = route.request();
      await route.continue({
        headers: { ...request.headers(), 'x-e2e-bypass': bypassSecret },
      });
    });
  }

  await emailField.fill(email);
  await page.locator('input[type="password"]').fill(password);

  // Attach the response listener BEFORE clicking, but treat it as best-effort:
  // on the mobile project under CI load the login POST can be slow, and making
  // a missed/slow response fatal was the main source of flakiness. The
  // authoritative success signal is leaving /login (below); the captured
  // response is only used to surface a precise error on a genuine failure.
  const responsePromise = page
    .waitForResponse(
      r => r.url().includes('/api/auth/login') && r.request().method() === 'POST',
      { timeout: 30_000 }
    )
    .catch(() => null);

  await page.click('button[type="submit"]');
  const response = await responsePromise;

  if (response && !response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  // Primary success criterion: redirected away from the login page.
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 });
}

export async function loginAsAdmin(page: Page) {
  await loginAs(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function loginAsTeacher(page: Page) {
  await loginAs(page, TEACHER_EMAIL, TEACHER_PASSWORD);
}

export async function loginAsOwner(page: Page) {
  await loginAs(page, OWNER_EMAIL, DEMO_PASSWORD);
}

export async function loginAsPrincipal(page: Page) {
  await loginAs(page, PRINCIPAL_EMAIL, DEMO_PASSWORD);
}

export async function loginAsAccountant(page: Page) {
  await loginAs(page, ACCOUNTANT_EMAIL, DEMO_PASSWORD);
}

export async function loginAsCounsellor(page: Page) {
  await loginAs(page, COUNSELLOR_EMAIL, DEMO_PASSWORD);
}

export async function loginAsDeo(page: Page) {
  await loginAs(page, DEO_EMAIL, DEMO_PASSWORD);
}

export async function loginAsMeo(page: Page) {
  await loginAs(page, MEO_EMAIL, DEMO_PASSWORD);
}

export async function expectNoErrors(page: Page) {
  return page.locator('[data-testid="error"], .error-message, [role="alert"]').count();
}
