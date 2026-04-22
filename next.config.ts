import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb", // for book cover uploads
    },
  },
};

export default nextConfig;
