import { defineConfig } from 'vitest/config';
import path from 'path';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

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
    reporters: ['default'],
    outputFile: {
      json: 'test-results/unit-results.json',
    },
    coverage: {
      enabled: false, // coverage adds cost — enable explicitly when needed
    },
    testTimeout: 30000,
  },
});
