import { defineConfig } from 'vitest/config';
import path from 'path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key_for_build_purposes_only';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_role_key_for_build_purposes_only';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'placeholder_session_secret_for_build_purposes_only_32_chars';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-placeholder-for-build';


export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    reporters: ['default', 'junit'],
    outputFile: {
      json: 'test-results/unit-results.json',
      junit: 'test-results/unit-junit.xml',
    },
    // Phase 0.4 — you cannot manage what you cannot measure. Coverage was off,
    // so "76 test files" was the only number anyone could quote, and it says
    // nothing about what is actually exercised.
    //
    // Reporting is on; thresholds are deliberately NOT enforced yet. The first
    // job is to establish the real baseline. Once a few runs agree on a number,
    // set `thresholds` just under it and ratchet upward — turning thresholds on
    // before the baseline is known just produces a red build nobody trusts.
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text-summary', 'json-summary', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Scoped to lib/ deliberately. An earlier revision also listed
      // 'app/api/**/*.ts'; combined with `all`, that pulls ~400 route modules
      // into the coverage pass purely to report 0% on them, which is slow and
      // drags unrelated module-load failures into the test run.
      include: ['lib/**/*.ts'],
      exclude: ['**/*.d.ts', '**/node_modules/**'],
      // Measure what the tests actually execute, not every file that exists.
      // That is the honest baseline: "of the code our tests touch, how much do
      // they check?" Widen this once the number is trusted.
      all: false,
      // NOTE: do not add `thresholdAutoUpdate` here. It is a Vitest 0.x option,
      // removed in 1.x, and `next build` type-checks this file — an unknown key
      // fails the production build, not just the test run.
    },
    testTimeout: 30000,
  },
});
