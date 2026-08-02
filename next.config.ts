import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ESLint: warnings (react-hooks/exhaustive-deps, unescaped entities) don't block
  // production builds. These are tracked in CI and addressed incrementally.
  // TypeScript errors ARE blocking — strict type checking is on.
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverMinification: false,
  },
};

export default nextConfig;
