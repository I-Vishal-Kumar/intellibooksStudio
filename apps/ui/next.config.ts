import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Enable for Docker deployment
  experimental: {
    // Optimize for production
  },
};

export default nextConfig;
