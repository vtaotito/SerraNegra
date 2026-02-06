import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  // Rewrites para API - proxy para gateway/api
  async rewrites() {
    // Se NEXT_PUBLIC_API_BASE_URL está definido, não usar rewrite
    // (o axios já vai fazer requisição direta para a URL configurada)
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      return [];
    }
    
    // Apenas para produção (quando não há NEXT_PUBLIC_API_BASE_URL)
    return [
      {
        source: "/api/:path*",
        destination: "http://gateway:3000/:path*",
      },
    ];
  },
};

export default nextConfig;
