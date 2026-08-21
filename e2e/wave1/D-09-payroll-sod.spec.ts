// e2e/wave1/D-09-payroll-sod.spec.ts
// D-09: Payroll self-approval — creator can approve and pay their own run
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-09: Payroll Segregation of Duties (SoD)', () => {
  test('payroll run approve action must forbid self-approval by creator', async () => {
    const routePath = path.resolve(process.cwd(), 'app/api/admin/payroll/runs/[id]/route.ts');
    const source = fs.readFileSync(routePath, 'utf8');

    // On unpatched main, the PATCH handler allows creator to approve their own run without checking run.created_by !== ctx.userId
    const hasCreatorCheck = source.includes('created_by') && 
      (source.includes('created_by === ctx.userId') || source.includes('created_by !== ctx.userId'));

    // Assert that the SoD check is present in the route
    expect(hasCreatorCheck).toBe(true);
  });
});
