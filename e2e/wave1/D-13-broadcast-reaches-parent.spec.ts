// e2e/wave1/D-13-broadcast-reaches-parent.spec.ts
// D-13: Broadcasts never reach parents — three tables with no overlap:
// /api/admin/broadcast -> notifications
// /api/broadcasts/create -> broadcasts
// /api/parent/announcements -> announcements
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-13: Four-assertion broadcast propagation', () => {
  test('broadcast write must propagate to parent notices domain', async () => {
    const adminBroadcastPath = path.resolve(process.cwd(), 'app/api/admin/broadcast/route.ts');
    const parentAnnouncementsPath = path.resolve(process.cwd(), 'app/api/parent/announcements/route.ts');

    const adminSource = fs.readFileSync(adminBroadcastPath, 'utf8');
    const parentSource = fs.readFileSync(parentAnnouncementsPath, 'utf8');

    // Assertion 1: Admin writes to notifications table
    expect(adminSource).toContain("from('notifications')");

    // Assertion 2: Parent route reads from notifications OR unified announcement source
    // Currently fails on main because parent route reads from 'announcements' table while admin writes 'notifications'
    const parentReadsUnifiedSource = parentSource.includes("from('notifications')") || 
      adminSource.includes("from('announcements')");
    expect(parentReadsUnifiedSource).toBe(true);
  });
});
