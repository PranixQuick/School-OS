import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// EXEC-02 Phase 3 — first end-to-end WORKFLOW PROPAGATION certification.
// Proves a write through the admin API is durable and immediately visible through the read API:
//   POST /api/students  (getSession-gated, admin) -> row created
//   GET  /api/students?search=<marker>            -> the same row is returned (propagation)
// Cleanup is a best-effort soft-delete (PATCH is_active:false) and is intentionally NON-FATAL
// so an unrelated PATCH-shape change can never red this certification. All rows are uniquely
// marked E2E_PROP_<ts> on the Suchitra demo tenant (synthetic/reversible).

test.describe('Workflow propagation — student create→read (EXEC-02 / Phase 3)', () => {
  test('admin POST /api/students propagates to GET /api/students', async ({ page }) => {
    await loginAsAdmin(page);
    const marker = `E2E_PROP_${Date.now()}`;

    // CREATE
    const createRes = await page.request.post('/api/students', {
      data: { name: marker, class: 'E2E', section: 'Z' },
    });
    expect(createRes.ok(), `create failed (status ${createRes.status()})`).toBeTruthy();
    const created = await createRes.json();
    expect(created.success, 'create did not report success').toBeTruthy();
    const id = created.student?.id;
    expect(id, 'no student id returned from POST').toBeTruthy();

    // PROPAGATION — the new row is readable through the list endpoint
    const listRes = await page.request.get(`/api/students?search=${encodeURIComponent(marker)}`);
    expect(listRes.ok(), `list failed (status ${listRes.status()})`).toBeTruthy();
    const list = await listRes.json();
    const found = (list.students ?? []).some((s: { id?: string }) => s.id === id);
    expect(found, `created student ${id} did not propagate to GET /api/students`).toBeTruthy();

    // CLEANUP — best-effort soft delete (non-fatal)
    const del = await page.request.patch('/api/students', { data: { id, is_active: false } });
    if (!del.ok()) console.warn(`[cleanup] PATCH is_active:false returned ${del.status()} for ${id}`);
  });
});
