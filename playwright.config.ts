import { defineConfig, devices } from '@playwright/test';

// Playwright E2E config for EdProSys.
// Tests run against the production URL (PLAYWRIGHT_BASE_URL) or localhost:3000 for local runs.
// CI: tests triggered on every push to main.
//
// NOTE: GitHub Actions sets unset secrets to empty string "".
// Use || (not ??) for fallbacks so empty string also falls back to the default.

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // EdProSys has shared demo data — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://www.edprosys.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: undefined,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testMatch: '**/01-admin-login.spec.ts',
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testMatch: '**/01-admin-login.spec.ts',
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testMatch: '**/01-admin-login.spec.ts',
    },
  ],
});
