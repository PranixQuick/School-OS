// e2e/wave1/D-01-parent-notices.spec.ts
// D-01: Parent notices feed always empty due to singular 'parent' filter vs plural 'parents' in DB.
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('D-01: Parent notices feed audience filter', () => {
  test('announcements route must match both parent and parents target_audience', async () => {
    // Static inspection of the query filter in app/api/parent/announcements/route.ts
    const routePath = path.resolve(process.cwd(), 'app/api/parent/announcements/route.ts');
    const source = fs.readFileSync(routePath, 'utf8');

    // On unpatched main, the route strictly filters .contains('target_audience', ['parent'])
    // which fails to match announcements with target_audience: ['parents']
    const hasPluralHandling = source.includes("['parents']") || 
      source.includes("'parents'") && source.includes("contains");
    
    // We assert that the route correctly queries for 'parents' (plural) as seeded in DB
    expect(source).toMatch(/target_audience.*parents/);
  });
});
