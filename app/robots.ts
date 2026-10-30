import type { MetadataRoute } from "next";

// The POS must never appear in search results. It is also `noindex` in its layout.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/pos", "/api"] },
  };
}
