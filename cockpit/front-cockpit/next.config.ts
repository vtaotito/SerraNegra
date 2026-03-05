import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  basePath: "/cockpit",
  assetPrefix: "/cockpit",
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
