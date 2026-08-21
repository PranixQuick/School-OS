// e2e/wave1/D-02-broadcast-history.spec.ts
// D-02: Admin broadcast history module mismatch (writes module: 'announcement', reads module: 'broadcast')
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-02: Admin broadcast history alignment', () => {
  test('POST write module must match GET filter module in /api/admin/broadcast', async () => {
    const routePath = path.resolve(process.cwd(), 'app/api/admin/broadcast/route.ts');
    const source = fs.readFileSync(routePath, 'utf8');

    // In unpatched main:
    // Line 76: module: 'announcement'
    // Line 114: .eq('module', 'broadcast')
    const postModuleMatch = source.match(/writeNotification\([\s\S]*?module:\s*['"]([^'"]+)['"]/);
    const getModuleMatch = source.match(/\.eq\(['"]module['"],\s*['"]([^'"]+)['"]\)/);

    expect(postModuleMatch).not.toBeNull();
    expect(getModuleMatch).not.toBeNull();

    const writeModule = postModuleMatch ? postModuleMatch[1] : '';
    const readModule = getModuleMatch ? getModuleMatch[1] : '';

    // Assertion: write module must equal read module so history lists what was sent
    expect(writeModule).toBe(readModule);
  });
});
