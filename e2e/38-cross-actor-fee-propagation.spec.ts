import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsParent } from './helpers/auth';

// EXEC-02 Phase 3 — first CROSS-ACTOR propagation cert: a write by one stakeholder (admin)
// becomes visible to a DIFFERENT stakeholder on a different auth domain (parent), and a delete
// by the admin makes it vanish from the parent's app — the guarantee documented in
// app/api/parent/fees/route.ts ("a deleted/cancelled fee must vanish from the parent's app").
//
// Both auth domains coexist on one page: loginAsParent sets the parent_session cookie and
// loginAsAdmin sets the school_session cookie (x-e2e-bypass) — independent cookie names. Parent
// reads use the cookie (getParentSession); admin writes use the cookie (requireAdminSession).
// Side-effect-free: fee create/delete do not dispatch SMS/WhatsApp. Seeded parent 9999900001 ->
// student "Aadhya Sharma" on Suchitra; loginAsAdmin (admin@suchitracademy.edu.in) is the same
// Suchitra tenant (verified via live DB), so the cross-tenant guard permits the assignment.

test.describe('Cross-actor fee propagation (EXEC-02 / Phase 3)', () => {
  test('admin assigns a fee → parent sees it → admin deletes → it vanishes for the parent', async ({ page }) => {
    // Parent actor (proven PIN login -> parent_session cookie). Discover the child id via dashboard.
    await loginAsParent(page);
    const dashRes = await page.request.get('/api/parent/dashboard');
    expect(dashRes.ok(), `parent/dashboard failed (${dashRes.status()})`).toBeTruthy();
    const dash = await dashRes.json();
    const studentId: string | undefined = dash?.active_child_id ?? dash?.children?.[0]?.id;
    expect(studentId, 'could not resolve seeded parent student id').toBeTruthy();

    // Admin actor (x-e2e-bypass -> school_session), same Suchitra tenant. Both cookies coexist.
    await loginAsAdmin(page);

    const marker = `E2E_FEE_${Date.now()}`;
    const createRes = await page.request.post('/api/admin/fees', {
      data: { student_id: studentId, amount: 4242, due_date: '2026-12-31', fee_type: 'other', description: marker },
    });
    expect(createRes.ok(), `admin fee create failed (${createRes.status()}: ${await createRes.text()})`).toBeTruthy();
    const created = await createRes.json();
    const feeId: string | undefined = created?.fee?.id ?? created?.data?.id ?? created?.id;
    expect(feeId, 'admin fee create did not return an id').toBeTruthy();

    // PROPAGATION (cross-actor): the parent sees the admin-created fee (parent_session cookie).
    const before = await page.request.get('/api/parent/fees');
    expect(before.ok(), `parent/fees read failed (${before.status()})`).toBeTruthy();
    const beforeFees = (await before.json())?.fees ?? [];
    expect(
      beforeFees.some((f: { id?: string }) => f.id === feeId),
      `parent did not see admin-created fee ${feeId}`,
    ).toBeTruthy();

    // Admin soft-cancels the fee (mandatory reason).
    const del = await page.request.delete(`/api/admin/fees/${feeId}`, {
      data: { reason: 'e2e cross-actor propagation cleanup' },
    });
    expect(del.ok(), `admin fee delete failed (${del.status()}: ${await del.text()})`).toBeTruthy();

    // GUARANTEE: the deleted fee vanishes from the parent's app (is_deleted filter).
    const after = await page.request.get('/api/parent/fees');
    expect(after.ok(), `parent/fees re-read failed (${after.status()})`).toBeTruthy();
    const afterFees = (await after.json())?.fees ?? [];
    expect(
      afterFees.some((f: { id?: string }) => f.id === feeId),
      `deleted fee ${feeId} should have vanished from the parent's app`,
    ).toBeFalsy();
  });
});
