import { defineConfig, devices } from '@playwright/test';

// Playwright E2E config for School OS.
// Tests run against the preview deployment URL (set via PLAYWRIGHT_BASE_URL env)
// or localhost:3000 for local runs.
// CI: tests triggered by GitHub Actions on every PR.
//
// I6 NOTE: Firefox + WebKit projects are defined here but require ci.yml to run
// `npx playwright install --with-deps` (not `install chromium`).
// Until the ci.yml workflow scope is updated, only Chromium runs in CI.
// To enable: update ci.yml Install Playwright step to remove the 'chromium' qualifier.

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // School OS has shared demo data — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Sequential to avoid demo-data contention
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: undefined, // each test handles its own auth
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox + WebKit: enable once ci.yml installs all browsers
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: '**/01-admin-login.spec.ts' },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] }, testMatch: '**/01-admin-login.spec.ts' },
  ],
});
