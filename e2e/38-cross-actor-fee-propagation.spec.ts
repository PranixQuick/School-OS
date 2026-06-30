import { test, expect } from '@playwright/test';
import { loginAsOwner, loginAsParent } from './helpers/auth';

// EXEC-02 Phase 3 — first CROSS-ACTOR propagation cert: a write by one stakeholder (school owner)
// becomes visible to a DIFFERENT stakeholder on a different auth domain (parent), and a delete by
// the owner makes it vanish from the parent's app — the guarantee documented in
// app/api/parent/fees/route.ts ("a deleted/cancelled fee must vanish from the parent's app").
//
// Two design points learned the hard way:
//  1) TENANT: in CI, loginAsAdmin (TEST_ADMIN_EMAIL) is an admin of the "E2E Test School" tenant —
//     NOT the Suchitra sandbox (…0001) where the seeded parent/student live. loginAsOwner resolves
//     to demo.owner@suchitra (verified owner on …0001), the SAME tenant as the parent, so the
//     cross-tenant guard permits the fee assignment.
//  2) ONE PAGE: both sessions live on a single page via independent cookies — parent_session
//     (PIN) and school_session (x-e2e-bypass). A manually-created browser context does NOT inherit
//     the Playwright config (baseURL etc.) and broke parent auth, so we use the default page, which
//     is the proven path (see spec 32). Parent reads use parent_session; owner writes use
//     school_session. Side-effect-free: fee create/delete do not dispatch SMS/WhatsApp.

test.describe('Cross-actor fee propagation (EXEC-02 / Phase 3)', () => {
  test('owner assigns a fee → parent sees it → owner deletes → it vanishes for the parent', async ({ page }) => {
    // ── Parent actor (parent_session via PIN) — discover the child id. ──
    await loginAsParent(page);
    const dashRes = await page.request.get('/api/parent/dashboard');
    expect(dashRes.ok(), `parent/dashboard failed (${dashRes.status()})`).toBeTruthy();
    const dash = await dashRes.json();
    const studentId: string | undefined = dash?.active_child_id ?? dash?.children?.[0]?.id;
    expect(studentId, 'could not resolve seeded parent student id').toBeTruthy();

    // ── Owner actor (school_session via bypass, SAME Suchitra tenant). parent_session persists. ──
    await loginAsOwner(page);

    const marker = `E2E_FEE_${Date.now()}`;
    const createRes = await page.request.post('/api/admin/fees', {
      data: { student_id: studentId, amount: 4242, due_date: '2026-12-31', fee_type: 'other', description: marker },
    });
    expect(createRes.ok(), `owner fee create failed (${createRes.status()}: ${await createRes.text()})`).toBeTruthy();
    const created = await createRes.json();
    const feeId: string | undefined = created?.fee?.id ?? created?.data?.id ?? created?.id;
    expect(feeId, 'owner fee create did not return an id').toBeTruthy();

    // PROPAGATION (cross-actor): the parent sees the owner-created fee (parent_session cookie).
    const before = await page.request.get('/api/parent/fees');
    expect(before.ok(), `parent/fees read failed (${before.status()})`).toBeTruthy();
    const beforeFees = (await before.json())?.fees ?? [];
    expect(
      beforeFees.some((f: { id?: string }) => f.id === feeId),
      `parent did not see owner-created fee ${feeId}`,
    ).toBeTruthy();

    // Owner soft-cancels the fee (mandatory reason).
    const del = await page.request.delete(`/api/admin/fees/${feeId}`, {
      data: { reason: 'e2e cross-actor propagation cleanup' },
    });
    expect(del.ok(), `owner fee delete failed (${del.status()}: ${await del.text()})`).toBeTruthy();

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
