// e2e/02-fee-templates.spec.ts
// Fee template CRUD via API.
// Uses page.request (browser context) — NOT the request fixture.
// The request fixture bypasses Next.js middleware; page.request goes through
// the full edge pipeline which injects x-school-id headers required by admin-auth.
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Fee template API', () => {
  // Use page-scoped serial tests so the browser context (and session cookie) persists
  test.use({ storageState: undefined });

  test('GET /api/admin/fee-templates returns array', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.get('/api/admin/fee-templates');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty('templates');
    expect(Array.isArray(body.templates)).toBe(true);
  });

  test('POST /api/admin/fee-templates creates template', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/fee-templates', {
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
    // Cleanup
    if (body.id) {
      await page.request.delete(`/api/admin/fee-templates/${body.id}`);
    }
  });

  test('POST /api/admin/fee-templates rejects invalid fee_items', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/fee-templates', {
      data: { name: 'Bad Template', grade_level: '5', fee_items: [] },
    });
    expect(resp.status()).toBe(400);
  });
});
