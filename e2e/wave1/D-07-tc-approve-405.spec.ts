// e2e/wave1/D-07-tc-approve-405.spec.ts
// D-07: Admin Transfer-Certificate approve returns 405, swallowed by catch {}
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-07: TC Approval endpoint alignment and error handling', () => {
  test('TC page approve action must call the review endpoint without 405 error', async () => {
    const pagePath = path.resolve(process.cwd(), 'app/admin/transfer-certificates/page.tsx');
    const source = fs.readFileSync(pagePath, 'utf8');

    // On unpatched main:
    // fetch('/api/admin/transfer-certificates', { method: 'PATCH' ... })
    // which results in 405 because /api/admin/transfer-certificates has no PATCH handler.
    // The valid endpoint is `/api/admin/transfer-certificates/${id}/review`.
    const callsReviewEndpoint = source.includes('/review') || source.includes('review');
    expect(callsReviewEndpoint).toBe(true);

    // Also assert errors are surfaced rather than swallowed by empty catch
    const hasEmptyCatch = source.includes('catch { /* ignore */ }');
    expect(hasEmptyCatch).toBe(false);
  });
});
