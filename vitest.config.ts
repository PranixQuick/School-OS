import { defineConfig } from 'vitest/config';

export default defineConfig({
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
  },
});
