import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@mcmuff86/pdf-core'],
  serverExternalPackages: ['pdf-parse', 'xlsx'],
};

export default nextConfig;
