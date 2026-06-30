import { test, expect } from '@playwright/test';
import { loginAsOwner, loginAsParent, BASE_URL } from './helpers/auth';

// EXEC-02 Phase 3 — first CROSS-ACTOR propagation cert: a write by one stakeholder (school admin)
// becomes visible to a DIFFERENT stakeholder on a different auth domain (parent), and a delete by
// the admin makes it vanish from the parent's app — the guarantee documented in
// app/api/parent/fees/route.ts ("a deleted/cancelled fee must vanish from the parent's app").
//
// TENANT NOTE (root-cause of the earlier failures): in CI, loginAsAdmin resolves via the
// TEST_ADMIN_EMAIL secret to an admin in the "E2E Test School" tenant — NOT the Suchitra sandbox
// (…0001) where the seeded parent/student live. We therefore use loginAsOwner, which resolves to
// demo.owner@suchitra (verified owner on …0001), the SAME tenant as the parent, so the
// cross-tenant guard permits the fee assignment.
//
// The two actors live in SEPARATE browser contexts (cookies never interact); the manually-created
// parent context is given an explicit baseURL since manual contexts don't inherit the config one.
// The student id is discovered from the PARENT side (parent/dashboard) — no admin-tenant dependency.
// Side-effect-free: fee create/delete do not dispatch SMS/WhatsApp.

test.describe('Cross-actor fee propagation (EXEC-02 / Phase 3)', () => {
  test('admin assigns a fee → parent sees it → admin deletes → it vanishes for the parent', async ({ page, browser }) => {
    const parentCtx = await browser.newContext({ baseURL: BASE_URL });
    try {
      // ── Parent actor (isolated context, PIN parent_session) ──
      const parentPage = await parentCtx.newPage();
      await loginAsParent(parentPage);

      const dashRes = await parentPage.request.get('/api/parent/dashboard');
      expect(dashRes.ok(), `parent/dashboard failed (${dashRes.status()})`).toBeTruthy();
      const dash = await dashRes.json();
      const studentId: string | undefined = dash?.active_child_id ?? dash?.children?.[0]?.id;
      expect(studentId, 'could not resolve seeded parent student id').toBeTruthy();

      // ── Admin actor (default page, owner on the SAME Suchitra tenant) ──
      await loginAsOwner(page);

      const marker = `E2E_FEE_${Date.now()}`;
      const createRes = await page.request.post('/api/admin/fees', {
        data: { student_id: studentId, amount: 4242, due_date: '2026-12-31', fee_type: 'other', description: marker },
      });
      expect(createRes.ok(), `owner fee create failed (${createRes.status()}: ${await createRes.text()})`).toBeTruthy();
      const created = await createRes.json();
      const feeId: string | undefined = created?.fee?.id ?? created?.data?.id ?? created?.id;
      expect(feeId, 'owner fee create did not return an id').toBeTruthy();

      // PROPAGATION (cross-actor): the parent sees the admin-created fee.
      const before = await parentPage.request.get('/api/parent/fees');
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
      expect(del.ok(), `owner fee delete failed (${del.status()}: ${await del.text()})`).toBeTruthy();

      // GUARANTEE: the deleted fee vanishes from the parent's app (is_deleted filter).
      const after = await parentPage.request.get('/api/parent/fees');
      expect(after.ok(), `parent/fees re-read failed (${after.status()})`).toBeTruthy();
      const afterFees = (await after.json())?.fees ?? [];
      expect(
        afterFees.some((f: { id?: string }) => f.id === feeId),
        `deleted fee ${feeId} should have vanished from the parent's app`,
      ).toBeFalsy();
    } finally {
      await parentCtx.close();
    }
  });
});
