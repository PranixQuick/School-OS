// e2e/02-fee-templates.spec.ts
// Critical path: fee template CRUD via API.
// Uses direct API calls (not UI navigation) to verify correctness without
// depending on UI page that may not exist yet.
import { test, expect } from '@playwright/test';
import { loginAsAdmin, BASE_URL } from './helpers/auth';

test.describe('Fee template API', () => {
  let sessionCookie = '';

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await loginAsAdmin(page);
    // Capture session cookie
    const cookies = await page.context().cookies();
    const session = cookies.find(c => c.name === 'school_session');
    if (session) sessionCookie = `${session.name}=${session.value}`;
    await page.close();
  });

  test('GET /api/admin/fee-templates returns array', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/api/admin/fee-templates`, {
      headers: sessionCookie ? { cookie: sessionCookie } : {},
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('templates');
    expect(Array.isArray(body.templates)).toBe(true);
  });

  test('POST /api/admin/fee-templates creates template', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/admin/fee-templates`, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
      data: {
        name: 'E2E Test Template',
        grade_level: '5',
        fee_items: [{ fee_type: 'tuition', amount: 10000 }],
      },
    });
    expect([200, 201]).toContain(resp.status());
    const body = await resp.json();
    expect(body).toHaveProperty('id');
    expect(body.grade_level).toBe('5');
    // Cleanup: soft delete
    if (body.id) {
      await request.delete(`${BASE_URL}/api/admin/fee-templates/${body.id}`, {
        headers: sessionCookie ? { cookie: sessionCookie } : {},
      });
    }
  });

  test('POST /api/admin/fee-templates rejects invalid fee_items', async ({ request }) => {
    const resp = await request.post(`${BASE_URL}/api/admin/fee-templates`, {
      headers: {
        'Content-Type': 'application/json',
        ...(sessionCookie ? { cookie: sessionCookie } : {}),
      },
      data: {
        name: 'Bad Template',
        grade_level: '5',
        fee_items: [], // empty — invalid
      },
    });
    expect(resp.status()).toBe(400);
  });
});
