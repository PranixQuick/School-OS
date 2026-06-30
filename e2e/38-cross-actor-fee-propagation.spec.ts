import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsParent, E2E_STUDENT_ADM } from './helpers/auth';

// EXEC-02 Phase 3 — first CROSS-ACTOR propagation cert: a write by one stakeholder (admin)
// becomes visible to a DIFFERENT stakeholder on a different auth domain (parent), and a delete
// by the admin makes it vanish from the parent's app — the guarantee documented in
// app/api/parent/fees/route.ts ("a deleted/cancelled fee must vanish from the parent's app").
//
// The two actors live in SEPARATE browser contexts so their session cookies never interact:
//   - admin  -> `page` (x-e2e-bypass school_session)            : list students, create + delete fee
//   - parent -> isolated context (PIN parent_session)           : read /api/parent/fees
// The student is discovered from the admin side (students list, by admission number) so no
// cross-domain cookie juggling is needed. Side-effect-free: fee create/delete do not dispatch
// SMS/WhatsApp. Verified via live DB: seeded student "Aadhya Sharma" (admission SA-KG-001) and
// admin@suchitracademy.edu.in are both on Suchitra (…0001), so the cross-tenant guard permits it.

test.describe('Cross-actor fee propagation (EXEC-02 / Phase 3)', () => {
  test('admin assigns a fee → parent sees it → admin deletes → it vanishes for the parent', async ({ page, browser }) => {
    // ── Admin actor (own context) ──
    await loginAsAdmin(page);

    // Discover the seeded student via the admin students list (by admission number).
    const stuRes = await page.request.get(`/api/students?search=${encodeURIComponent('Aadhya')}`);
    expect(stuRes.ok(), `admin students list failed (${stuRes.status()})`).toBeTruthy();
    const students = (await stuRes.json())?.students ?? [];
    const student =
      students.find((s: { admission_number?: string }) => s.admission_number === E2E_STUDENT_ADM) ?? students[0];
    const studentId: string | undefined = student?.id;
    expect(studentId, `could not find seeded student (${E2E_STUDENT_ADM})`).toBeTruthy();

    // Admin creates the fee.
    const marker = `E2E_FEE_${Date.now()}`;
    const createRes = await page.request.post('/api/admin/fees', {
      data: { student_id: studentId, amount: 4242, due_date: '2026-12-31', fee_type: 'other', description: marker },
    });
    expect(createRes.ok(), `admin fee create failed (${createRes.status()}: ${await createRes.text()})`).toBeTruthy();
    const created = await createRes.json();
    const feeId: string | undefined = created?.fee?.id ?? created?.data?.id ?? created?.id;
    expect(feeId, 'admin fee create did not return an id').toBeTruthy();

    // ── Parent actor (ISOLATED context so cookies never interact) ──
    const parentCtx = await browser.newContext();
    try {
      const parentPage = await parentCtx.newPage();
      await loginAsParent(parentPage);

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
      expect(del.ok(), `admin fee delete failed (${del.status()}: ${await del.text()})`).toBeTruthy();

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
