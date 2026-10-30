import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
