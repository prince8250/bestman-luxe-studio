import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

// Checks "Authorization: Bearer <token>" against a secret (backup endpoints,
// spec 20; the owner job, spec 19). The two values are hashed first so they
// compare in constant time whatever their length: how long the check takes
// says nothing about how much of a guess was right. Nothing here is logged.
export function bearerMatches(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(given, expected);
}

// 401 with no details (never say which part was wrong).
export function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
}
