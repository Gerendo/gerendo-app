import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/privacy", destination: "https://gerendo.com/privacy", permanent: true },
      { source: "/security", destination: "https://gerendo.com/security", permanent: true },
      { source: "/terms", destination: "https://gerendo.com/terms", permanent: true },
    ];
  },
};

export default nextConfig;
