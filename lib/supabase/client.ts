import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";

// Browser client. Uses the public (anon) key, so it can only do what RLS lets
// a visitor or the signed-in POS user do. Use it for public reads and the POS
// sign-in form; anything that writes money goes through server actions.
export function createSupabaseBrowserClient() {
  const env = getPublicEnv();
  return createBrowserClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
