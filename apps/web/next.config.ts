import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile workspace packages so Next.js resolves `.js` import
  // specifiers (NodeNext convention) to their `.ts` source files.
  transpilePackages: ["@repo/auth", "@repo/db", "@repo/shared"],
  // Node runtime for all API routes (SPEC §5.1: Route Handlers run on Node runtime).
  // Next.js standalone output for Docker builds (Phase 5).
  output: "standalone",
  reactStrictMode: true,
  // Security headers (SPEC §7). The artifact sandbox iframe relies on
  // strict CSP; these are the host-app headers.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
  // Map `.js` import specifiers (required by NodeNext module resolution)
  // to `.ts` source files so webpack can resolve them inside transpiled
  // workspace packages.
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js", ".jsx"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

export default nextConfig;
