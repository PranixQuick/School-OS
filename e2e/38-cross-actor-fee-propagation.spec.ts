import { test, expect } from '@playwright/test';
import { loginAsAdmin, E2E_PARENT_PHONE, E2E_PARENT_PIN } from './helpers/auth';

// EXEC-02 Phase 3 — first CROSS-ACTOR propagation cert: a write by one stakeholder (admin)
// becomes visible to a DIFFERENT stakeholder on a different auth domain (parent), and a delete
// by the admin makes it vanish from the parent's app — the guarantee documented in
// app/api/parent/fees/route.ts ("a deleted/cancelled fee must vanish from the parent's app").
//
// Actors share one Playwright page: parent reads use phone+PIN bodies (lib/parent-auth, hash-aware);
// admin writes use the x-e2e-bypass school_session set by loginAsAdmin. Side-effect-free: fee
// creation does not dispatch SMS/WhatsApp. Seeded parent 9999900001 -> student "Aadhya Sharma"
// (Suchitra), and loginAsAdmin resolves to the same Suchitra tenant, so the admin may assign the fee.

function extractId(j: Record<string, unknown>): string | undefined {
  const fee = (j.fee ?? j.data ?? j) as Record<string, unknown> | undefined;
  const id = (fee?.id ?? (j as Record<string, unknown>).id) as string | undefined;
  return typeof id === 'string' ? id : undefined;
}

test.describe('Cross-actor fee propagation (EXEC-02 / Phase 3)', () => {
  test('admin assigns a fee → parent sees it → admin deletes → it vanishes for the parent', async ({ page }) => {
    // Discover the parent's student id (phone+PIN body; hash-aware verifyParentCredentials).
    const stuRes = await page.request.post('/api/parent/student', {
      data: { phone: E2E_PARENT_PHONE, pin: E2E_PARENT_PIN },
    });
    expect(stuRes.ok(), `parent/student failed (${stuRes.status()})`).toBeTruthy();
    const studentId = (await stuRes.json())?.student?.id as string | undefined;
    expect(studentId, 'could not resolve seeded parent student id').toBeTruthy();

    // Admin actor (school_session via bypass), same Suchitra tenant.
    await loginAsAdmin(page);

    const marker = `E2E_FEE_${Date.now()}`;
    const createRes = await page.request.post('/api/admin/fees', {
      data: { student_id: studentId, amount: 4242, due_date: '2026-12-31', fee_type: 'other', description: marker },
    });
    expect(createRes.ok(), `admin fee create failed (${createRes.status()}: ${await createRes.text()})`).toBeTruthy();
    const feeId = extractId(await createRes.json());
    expect(feeId, 'admin fee create did not return an id').toBeTruthy();

    // PROPAGATION (cross-actor): the parent sees the admin-created fee.
    const before = await page.request.post('/api/parent/fees', {
      data: { phone: E2E_PARENT_PHONE, pin: E2E_PARENT_PIN },
    });
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
    const after = await page.request.post('/api/parent/fees', {
      data: { phone: E2E_PARENT_PHONE, pin: E2E_PARENT_PIN },
    });
    expect(after.ok(), `parent/fees re-read failed (${after.status()})`).toBeTruthy();
    const afterFees = (await after.json())?.fees ?? [];
    expect(
      afterFees.some((f: { id?: string }) => f.id === feeId),
      `deleted fee ${feeId} should have vanished from the parent's app`,
    ).toBeFalsy();
  });
});
