import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ioredis", "ws"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "robohash.org",
      },
    ],
  },
};

export default nextConfig;
