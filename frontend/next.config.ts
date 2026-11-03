import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // Set by the Dockerfile; `next start` needs the default output.
  output: process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  // The browser only ever talks to this origin, so session cookies stay first-party. See docs/DEPLOYMENT.md.
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
