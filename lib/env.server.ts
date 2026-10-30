import "server-only";

import { parseServerEnv, type ServerEnv } from "@/lib/env";

let cachedServerEnv: ServerEnv | undefined;

// Secrets. `server-only` makes the build fail if a client component imports
// this file, so the service-role key can never reach the browser.
export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv(process.env);
  return cachedServerEnv;
}
