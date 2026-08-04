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
