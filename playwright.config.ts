import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://www.schoolos.in',
    trace: 'on-first-retry',
    // E2E runs against a PWA whose service worker (registered globally in
    // app/layout.tsx -> public/sw.js) is network-first and precaches '/login'
    // via cache.addAll on install. Under the mobile (Pixel 5) project this keeps
    // the network perpetually busy, so page.waitForLoadState('networkidle')
    // never settles within the 30s budget, and the active SW also intercepts
    // navigations on the traced retry. Blocking SW registration in the test
    // browser removes that interference. No test depends on a *running* SW:
    // e2e/22-offline-queue only HTTP-fetches /sw.js, /offline.html and
    // /manifest.json (which still return 200 with the SW blocked). Production
    // behaviour is unchanged — this affects the test browser only.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
});
