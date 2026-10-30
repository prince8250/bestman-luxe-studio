import "server-only";

import { cache } from "react";

import { isPosRole, type PosUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The signed-in POS user, or null. This is the data access layer for "who is
// calling": every POS page and server action goes through it (spec 04 adds
// requirePosUser / requirePermission on top).
//
// getClaims() verifies the session token on the server; the profile row then
// decides whether this account may use the POS at all (an auth user without a
// profile, or with active = false, is not a POS user).
// cache() makes it run once per request, however many components ask.
export const getPosUser = cache(async (): Promise<PosUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, role, active")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.active || !isPosRole(profile.role)) return null;
  return { id: profile.id, role: profile.role, displayName: profile.display_name };
});
