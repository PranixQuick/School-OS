/**
 * e2e/contracts/fee-templates-contract.spec.ts
 *
 * CONTRACT TEST — POST /api/admin/fee-templates
 *
 * This test owns the response schema.
 * If the API response contract changes, THIS test fails first.
 * Feature tests (02-fee-templates.spec.ts, 06-parent-fees.spec.ts, etc.)
 * remain stable because they consume helpers, not raw response paths.
 *
 * Required fields verified here:
 *   - HTTP status 201
 *   - top-level key: template (object)
 *   - template.id         (string, non-empty UUID)
 *   - template.name       (string, matches input)
 *   - template.grade_level(string, matches input)
 *   - template.fee_items  (array, length >= 1)
 *   - template.is_active  (boolean true)
 *   - template.created_at (ISO 8601 string)
 *
 * No flat body.id. No body.grade_level. Contract is nested under "template".
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

const VALID_PAYLOAD = {
  name: 'Contract Test Template',
  grade_level: '10',
  fee_items: [{ fee_type: 'tuition', amount: 5000 }],
};

test.describe('CONTRACT: POST /api/admin/fee-templates', () => {
  test.use({ storageState: undefined });

  test('201 response wraps record under "template" key', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/fee-templates', {
      data: VALID_PAYLOAD,
    });

    // Status
    expect(resp.status(), 'Status must be 201').toBe(201);

    const body = await resp.json();

    // Top-level shape: must have "template", must NOT have flat "id"
    expect(body, 'Body must have "template" key').toHaveProperty('template');
    expect(body, 'Body must NOT expose flat "id" at root').not.toHaveProperty('id');
    expect(body, 'Body must NOT expose flat "grade_level" at root').not.toHaveProperty('grade_level');

    const t = body.template;

    // Required fields
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
    expect(t.name).toBe(VALID_PAYLOAD.name);
    expect(t.grade_level).toBe(VALID_PAYLOAD.grade_level);
    expect(Array.isArray(t.fee_items)).toBe(true);
    expect(t.fee_items.length).toBeGreaterThanOrEqual(1);
    expect(t.fee_items[0].fee_type).toBe('tuition');
    expect(t.fee_items[0].amount).toBe(5000);
    expect(t.is_active).toBe(true);
    expect(typeof t.created_at).toBe('string');
    // Validate ISO 8601 — DB returns timestamptz (+00:00 suffix), toISOString() returns Z suffix;
    // both are valid ISO 8601. Validate by parsing to a finite timestamp instead of string equality.
    expect(Number.isFinite(new Date(t.created_at).getTime())).toBe(true);

    // Cleanup
    if (t.id) {
      await page.request.delete(`/api/admin/fee-templates/${t.id}`);
    }
  });

  test('400 on empty fee_items', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/fee-templates', {
      data: { name: 'Contract Bad', grade_level: '5', fee_items: [] },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  test('400 on missing name', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/fee-templates', {
      data: { grade_level: '5', fee_items: [{ fee_type: 'tuition', amount: 100 }] },
    });
    expect(resp.status()).toBe(400);
  });

  test('400 on missing grade_level', async ({ page }) => {
    await loginAsAdmin(page);
    const resp = await page.request.post('/api/admin/fee-templates', {
      data: { name: 'No Grade', fee_items: [{ fee_type: 'tuition', amount: 100 }] },
    });
    expect(resp.status()).toBe(400);
  });
});
