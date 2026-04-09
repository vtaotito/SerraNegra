import type { NextConfig } from "next";

const gatewayUrl = process.env.GATEWAY_INTERNAL_URL ?? "http://gateway:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    proxyTimeout: 120_000,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "garrafariaserranegra.com.br",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/sap/:path*", destination: `${gatewayUrl}/sap/:path*` },
      { source: "/api/v1/:path*", destination: `${gatewayUrl}/v1/:path*` },
    ];
  },
};

export default nextConfig;
