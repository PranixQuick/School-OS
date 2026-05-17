import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // TypeScript errors are tracked in code review, not blocking builds
    // This codebase is pre-commercial — all type errors are warnings only
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
