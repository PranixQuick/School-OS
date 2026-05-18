import { defineConfig, devices } from '@playwright/test';

// Playwright E2E config for EdProSys.
// Tests run against the preview deployment URL (set via PLAYWRIGHT_BASE_URL env)
// or localhost:3000 for local runs.
// CI: tests triggered by GitHub Actions on every PR.

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // EdProSys has shared demo data — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
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
