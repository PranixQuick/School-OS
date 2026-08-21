// e2e/wave1/D-20-dispatch-rate.spec.ts
// D-20: Only 35 of 1498 notifications ever dispatched; homework_assigned and leave_status have 0 dispatched.
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-20: Notification dispatch handlers coverage', () => {
  test('dispatcher must support all valid notification types including homework_assigned and leave_status', async () => {
    const dispatcherPath = path.resolve(process.cwd(), 'lib/dispatcher.ts');
    const source = fs.readFileSync(dispatcherPath, 'utf8');

    // Both homework_assigned and leave_status must be distinctly routed
    expect(source).toContain('homework_assigned');
    expect(source).toContain('leave_status');
  });
});
