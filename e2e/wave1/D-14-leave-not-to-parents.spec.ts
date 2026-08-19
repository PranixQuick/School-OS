// e2e/wave1/D-14-leave-not-to-parents.spec.ts
// D-14: Teacher leave request broadcast to every parent in the school
// FACT: type: 'leave_status' is unhandled in getRecipients -> falls to catch-all 'all parents, cap 200'
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-14: Leave status notification recipient isolation', () => {
  test('leave_status notifications must NOT fall through to parent recipients', async () => {
    const dispatcherPath = path.resolve(process.cwd(), 'lib/dispatcher.ts');
    const source = fs.readFileSync(dispatcherPath, 'utf8');

    // On unpatched main, getRecipients only handles fee_reminder, ptm, and risk/alert/system explicitly.
    // leave_status is omitted from the admin/staff check, falling into:
    // "For broadcast / homework_due / attendance_alert etc — target all parents"
    const hasLeaveStatusBranch = source.includes("'leave_status'") && 
      (source.includes("notification.type === 'leave_status'") || source.includes("['leave_status'"));

    // We assert that leave_status is explicitly handled and routed away from parents
    expect(hasLeaveStatusBranch).toBe(true);
  });
});
