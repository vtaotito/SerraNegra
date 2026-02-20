import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  basePath: "/b2b",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.tcdn.com.br",
        pathname: "/img/img_prod/**",
      },
      {
        protocol: "https",
        hostname: "garrafariaserranegra.com.br",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: "http://gateway:3000/:path*",
      },
    ];
  },
};

export default nextConfig;
