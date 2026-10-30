import type { NextConfig } from "next";

// Cache Components (`cacheComponents`) is deliberately off. The POS reads the
// signed-in user on every page, and the classic dynamic model (reading cookies
// makes a route dynamic) is simpler to reason about for access control.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Images uploaded in the POS live in Supabase Storage's public buckets.
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
  experimental: {
    // Two root layouts (website and POS) need a standalone 404 page:
    // app/global-not-found.tsx.
    globalNotFound: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
