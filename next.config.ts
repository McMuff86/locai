import type { NextConfig } from "next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";

const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  transpilePackages: ['@mcmuff86/pdf-core'],
  serverExternalPackages: ['pdf-parse', 'xlsx'],
};

export default withBundleAnalyzer(nextConfig);
