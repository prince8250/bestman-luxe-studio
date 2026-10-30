import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { getPublicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";

// Service-role client: bypasses RLS. Only for server-only code paths that have
// already validated their input and checked who is calling: public booking
// (after Turnstile and rate limits), counter-account management (owner only),
// backup exports (bearer token), and scheduled jobs.
// `server-only` makes the build fail if a client component ever imports this.
export function createSupabaseAdminClient() {
  return createClient<Database>(getPublicEnv().NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
