import "server-only";

import { createHash } from "node:crypto";

// The visitor's IP address as reported by the hosting proxy (Vercel sets
// x-forwarded-for; the first entry is the client).
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

// A short, stable, one-way key for rate limits, so raw emails, phone numbers,
// and IP addresses are never stored in the database.
export function hashedKey(kind: string, value: string): string {
  const digest = createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
  return `${kind}:${digest}`;
}
