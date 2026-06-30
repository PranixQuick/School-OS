import { test, expect } from '@playwright/test';
import { loginAsVendor } from './helpers/auth';

// EXEC-02 Phase B — vendor identity manufacturing. Vendor portal uses portal_email + PIN
// (lib/vendor-auth, bcrypt) and requires has_portal_access=true + is_active=true. Seeded sandbox
// vendor on Suchitra: e2e.vendor@suchitra.edprosys.demo / PIN 1234 (bcrypt). Certified guarantee:
// the vendor authenticates (login API returns 200 — helper throws otherwise) and the resulting
// vendor_session is honored by a protected vendor API (not 401).

test.describe('Vendor identity manufacturing (EXEC-02 / Phase B)', () => {
  test('vendor logs in (portal_email + PIN) and session is honored', async ({ page }) => {
    await loginAsVendor(page); // throws unless /api/vendor/login returns 200
    const res = await page.request.get('/api/vendor/me');
    expect(res.status(), 'vendor API should recognize the session (not 401)').not.toBe(401);
    expect(res.status(), 'vendor API should not be a server error').toBeLessThan(500);
  });
});
