// e2e/wave1/D-04-staff-alerts.spec.ts
// D-04: Staff alert bell has never worked; createStaffAlerts swallows errors in empty catch
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-04: Staff alerts insertion and error visibility', () => {
  test('createStaffAlerts must properly log and surface errors and not silently swallow them', async () => {
    const alertsPath = path.resolve(process.cwd(), 'lib/alerts.ts');
    const source = fs.readFileSync(alertsPath, 'utf8');

    // In unpatched main:
    // createStaffAlerts returns Promise<void> and catches errors without propagating or logging diagnostic detail
    const hasProperErrorSurfacing = source.includes("throw") || source.includes("[staff_alerts] insert failed");
    expect(hasProperErrorSurfacing).toBe(true);
  });
});
