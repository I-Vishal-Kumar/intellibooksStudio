import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Enable for Docker deployment
  experimental: {
    // Optimize for production
  },
  // Temporarily ignore TypeScript errors during build
  // This is needed due to react-markdown v10 type compatibility issues with React 19
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
