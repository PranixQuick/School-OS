// e2e/22-offline-queue.spec.ts
// Bible Phase 6 Priority 3: Offline queue + service worker
import { test, expect } from '@playwright/test';
import { BASE_URL } from './helpers/auth';

test.describe('Offline support', () => {
  test('service worker is registered', async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    // Check sw.js is accessible
    const swResp = await page.request.get(`${BASE_URL}/sw.js`);
    expect(swResp.status()).toBe(200);
    const swBody = await swResp.text();
    expect(swBody).toContain('edprosys-v1');
    await page.close();
  });

  test('offline.html is accessible', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/offline.html`);
    expect(resp.status()).toBe(200);
    const body = await resp.text();
    expect(body.toLowerCase()).toContain('offline');
  });

  test('manifest.json is valid', async ({ request }) => {
    const resp = await request.get(`${BASE_URL}/manifest.json`);
    expect(resp.status()).toBe(200);
    const manifest = await resp.json();
    expect(manifest.name).toBe('EdProSys');
    expect(manifest.short_name).toBe('EdProSys');
    expect(manifest.icons.length).toBeGreaterThan(0);
  });
});
