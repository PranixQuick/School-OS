import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // TypeScript errors block production builds.
  // ignoreBuildErrors was temporarily set during Phase 5 sprint — now reversed.
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
