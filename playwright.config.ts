import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...parts] = trimmed.split('=');
        const val = parts.join('=').trim().replace(/^['"]|['"]$/g, '');
        process.env[key.trim()] = val;
      }
    }
  }
} catch (e) {
  console.error('Failed to load .env file', e);
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'https://www.edprosys.com',
    trace: 'on',
    video: 'on',
    screenshot: 'on',
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
