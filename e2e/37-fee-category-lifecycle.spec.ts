import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// EXEC-02 Phase 3 — second-domain propagation, now a FULL lifecycle with real cleanup.
//   POST   /api/admin/fee-categories         -> create (201)
//   GET    /api/admin/fee-categories         -> appears in default (active) list      [propagation]
//   PATCH  /api/admin/fee-categories/:id     -> is_active:false                        [deactivate / cleanup]
//   GET    (default)                         -> gone
//   GET    ?show_inactive=true               -> still present                          [soft-delete semantics]
// All requireAdminSession-gated; rows uniquely named E2E_CAT_<ts> on the Suchitra demo tenant.

test.describe('Workflow propagation — fee category lifecycle (EXEC-02 / Phase 3)', () => {
  test('admin create→read→deactivate fee category, verifying soft-delete semantics', async ({ page }) => {
    await loginAsAdmin(page);
    const name = `E2E_CAT_${Date.now()}`;

    // CREATE
    const createRes = await page.request.post('/api/admin/fee-categories', {
      data: { name, description: 'e2e propagation cert' },
    });
    expect(createRes.status(), `create status was ${createRes.status()}`).toBe(201);
    const created = await createRes.json();
    const id = created.category?.id;
    expect(id, 'no category id returned from POST').toBeTruthy();

    // PROPAGATION — present in the default active list
    const listRes = await page.request.get('/api/admin/fee-categories');
    expect(listRes.ok(), `list status ${listRes.status()}`).toBeTruthy();
    const list = await listRes.json();
    expect(
      (list.categories ?? []).some((c: { id?: string }) => c.id === id),
      `category ${id} did not propagate to GET`,
    ).toBeTruthy();

    // DEACTIVATE — real cleanup via soft delete
    const patchRes = await page.request.patch(`/api/admin/fee-categories/${id}`, {
      data: { is_active: false },
    });
    expect(patchRes.ok(), `deactivate failed (${patchRes.status()})`).toBeTruthy();

    // VERIFY soft-delete semantics: gone from default, still present when show_inactive=true
    const afterRes = await page.request.get('/api/admin/fee-categories');
    const after = await afterRes.json();
    expect(
      (after.categories ?? []).some((c: { id?: string }) => c.id === id),
      `deactivated category ${id} should be gone from the default list`,
    ).toBeFalsy();

    const inactiveRes = await page.request.get('/api/admin/fee-categories?show_inactive=true');
    const inactive = await inactiveRes.json();
    expect(
      (inactive.categories ?? []).some((c: { id?: string }) => c.id === id),
      `category ${id} should still exist when show_inactive=true`,
    ).toBeTruthy();
  });
});
