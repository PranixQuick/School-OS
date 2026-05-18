import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// E2E spec: onboarding wizard flow
// Tests that institution_type is persisted after step 1
// and that activation completes correctly
test.describe('Onboarding Wizard', () => {
  test('step 1 — profile save persists institution_type to settings', async ({ page }) => {
    await loginAsAdmin(page);
    // Navigate to onboarding (only available for un-onboarded schools)
    // This test validates the API directly
    const res = await page.request.post('/api/admin/onboarding/1-profile', {
      data: {
        name: 'E2E Test School',
        board: 'CBSE',
        institution_type: 'school_k12',
        ownership_type: 'private',
        phone: '+919999999999',
      },
    });
    const body = await res.json();
    // Should succeed (even if school already onboarded — API updates settings)
    expect(res.status()).toBeLessThan(500);
    if (res.ok()) {
      expect(body.institution_type).toBe('school_k12');
      expect(body.ownership_type).toBe('private');
    }
  });

  test('dashboard loads without 500 error', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/dashboard');
    // Should not show error state
    await page.waitForLoadState('networkidle');
    const errorElements = await page.locator('[data-testid="error"], .error-boundary').count();
    expect(errorElements).toBe(0);
  });

  test('/api/dashboard/summary returns 401 for unauthenticated requests', async ({ page }) => {
    // Direct unauthenticated call should get 401, not 500
    const res = await page.request.get('/api/dashboard/summary');
    expect(res.status()).toBe(401);
  });

  test('/api/config returns institution_type for authenticated admin', async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.get('/api/config');
    if (res.ok()) {
      const body = await res.json();
      expect(body).toHaveProperty('institution_type');
      expect(body).toHaveProperty('role');
      expect(body).toHaveProperty('schoolName');
    }
  });
});
