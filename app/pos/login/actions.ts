"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isLoginLocked, LOGIN_WINDOW_SECONDS, loginDelayMs } from "@/lib/auth/login-throttle";
import { homePathFor, isPosRole } from "@/lib/auth/types";
import { getClientIp, hashedKey } from "@/lib/request";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SignInState {
  error: string | null;
  email: string;
}

// One message for every failure (wrong password, unknown email, no POS
// profile, deactivated account), so the form never reveals which it was.
const GENERIC_ERROR = "Sign-in failed. Check your email and password. If it still fails, ask the owner.";

const credentialsSchema = z.object({
  email: z.email().max(200),
  password: z.string().min(1).max(200),
});

export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const parsed = credentialsSchema.safeParse({ email, password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Enter your email and password.", email };
  }

  const requestHeaders = await headers();
  const emailKey = hashedKey("login-email", parsed.data.email);
  const ipKey = hashedKey("login-ip", getClientIp(requestHeaders));
  const admin = createSupabaseAdminClient();

  // Slow down (and eventually stop) repeated failures from one email or one device.
  const [emailFailures, ipFailures] = await Promise.all([
    admin.rpc("rate_limit_count", { p_key: emailKey, p_window_seconds: LOGIN_WINDOW_SECONDS }),
    admin.rpc("rate_limit_count", { p_key: ipKey, p_window_seconds: LOGIN_WINDOW_SECONDS }),
  ]);
  const failures = Math.max(emailFailures.data ?? 0, ipFailures.data ?? 0);
  if (isLoginLocked(failures)) {
    return { error: "Too many attempts. Wait 15 minutes, then try again.", email };
  }
  const delay = loginDelayMs(failures);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

  const recordFailure = () =>
    Promise.all([
      admin.rpc("rate_limit_hit", { p_key: emailKey, p_window_seconds: LOGIN_WINDOW_SECONDS }),
      admin.rpc("rate_limit_hit", { p_key: ipKey, p_window_seconds: LOGIN_WINDOW_SECONDS }),
    ]);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    await recordFailure();
    return { error: GENERIC_ERROR, email };
  }

  // A valid Supabase login is not enough: the account needs an active POS profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!profile || !profile.active || !isPosRole(profile.role)) {
    await supabase.auth.signOut();
    await recordFailure();
    return { error: GENERIC_ERROR, email };
  }

  // Every successful sign-in is recorded (the owner sees when the shop opened).
  // If it cannot be recorded, the sign-in does not go ahead.
  const { error: eventError } = await supabase.from("sign_in_events").insert({
    profile_id: data.user.id,
    user_agent: requestHeaders.get("user-agent")?.slice(0, 400) ?? null,
  });
  if (eventError) {
    console.error("sign_in_events insert failed", eventError.message);
    await supabase.auth.signOut();
    return { error: "Could not sign in right now. Check the internet connection and try again.", email };
  }

  await admin.rpc("rate_limit_clear", { p_key: emailKey });
  redirect(homePathFor(profile.role));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/pos/login");
}
