"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import type { PosUser } from "@/lib/auth/types";
import { counterAccountSchema, resetPasswordSchema, settingsInputSchema } from "@/lib/settings/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// POS Settings (spec 07), owner only.
// - Studio details, receipts, counter controls, and alert choices are saved
//   through the owner's own session; a database trigger logs every changed
//   setting with its old and new value.
// - Counter accounts need the Supabase admin API (service role). The owner
//   check runs first (runPosAction), the action only ever touches accounts
//   whose profile role is 'counter' (never the owner's own), and it writes the
//   audit_log row itself. Passwords are never logged or returned.

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

async function logAccountChange(owner: PosUser, accountId: string, action: string, after: Record<string, string>) {
  const { error } = await createSupabaseAdminClient().from("audit_log").insert({
    actor_id: owner.id,
    actor_name: owner.displayName,
    actor_role: "owner",
    entity: "profile",
    entity_id: accountId,
    action,
    after,
  });
  if (error) console.error("audit_log insert failed", action, error.message);
}

// The counter profile, or null (never the owner's own account).
async function findCounterAccount(id: string) {
  const { data } = await createSupabaseAdminClient()
    .from("profiles")
    .select("id, display_name, role, active")
    .eq("id", id)
    .maybeSingle();
  return data && data.role === "counter" ? data : null;
}

async function endSessions(userId: string): Promise<boolean> {
  const { error } = await createSupabaseAdminClient().rpc("end_user_sessions", { p_user_id: userId });
  if (error) console.error("end_user_sessions failed", error.message);
  return !error;
}

export async function saveSettingsAction(input: unknown): Promise<ActionResult> {
  return runPosAction("settings.edit", async (owner) => {
    const parsed = settingsInputSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const values = parsed.data;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("studio_settings")
      .update({
        studio_name: values.studioName,
        phone: values.phone,
        whatsapp: values.whatsapp,
        address: values.address,
        map_url: values.mapUrl,
        opening_hours: values.openingHours,
        social_links: Object.fromEntries(Object.entries(values.socialLinks).filter(([, url]) => url)),
        about_text: values.aboutText,
        receipt_header: values.receiptHeader,
        receipt_footer: values.receiptFooter,
        receipt_copies: values.receiptCopies,
        booking_sound: values.bookingSound,
        max_counter_discount_percent: values.maxCounterDiscountPercent,
        counter_backdate_days: values.counterBackdateDays,
        default_opening_float: values.defaultOpeningFloat,
        cash_difference_tolerance: values.cashDifferenceTolerance,
        override_alert_threshold: values.overrideAlertThreshold,
        owner_alert_phone: values.ownerAlertPhone,
        alert_settings: values.alertSettings,
        daily_sms_cap: values.dailySmsCap,
        updated_by: owner.id,
      })
      .eq("id", true);
    if (error) return fail(dbErrorMessage(error, "save settings"));
    revalidatePath("/pos/settings");
    return ok(undefined);
  });
}

export async function createCounterAccountAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runPosAction("accounts.manage", async (owner) => {
    const parsed = counterAccountSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const { displayName, email, password } = parsed.data;
    const admin = createSupabaseAdminClient();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error || !data.user) {
      const exists = error?.message.toLowerCase().includes("already");
      if (!exists) console.error("createUser failed", error?.message);
      return fail(exists ? "That email already has an account." : "Could not create the account. Try again.");
    }

    const { error: profileError } = await admin
      .from("profiles")
      .insert({ id: data.user.id, display_name: displayName, role: "counter", active: true });
    if (profileError) {
      // Do not leave a login without a POS profile behind.
      await admin.auth.admin.deleteUser(data.user.id);
      console.error("counter profile insert failed", profileError.message);
      return fail("Could not create the account. Try again.");
    }

    await logAccountChange(owner, data.user.id, "account_created", { display_name: displayName, email, role: "counter" });
    revalidatePath("/pos/settings");
    return ok({ id: data.user.id });
  });
}

// A new password also ends every session, so whoever had the old one is out.
export async function resetCounterPasswordAction(input: unknown): Promise<ActionResult> {
  return runPosAction("accounts.manage", async (owner) => {
    const parsed = resetPasswordSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const account = await findCounterAccount(parsed.data.id);
    if (!account) return fail("That counter account was not found.");

    const { error } = await createSupabaseAdminClient().auth.admin.updateUserById(account.id, {
      password: parsed.data.password,
    });
    if (error) {
      console.error("password reset failed", error.message);
      return fail("Could not change the password. Try again.");
    }
    const signedOut = await endSessions(account.id);
    await logAccountChange(owner, account.id, "account_password_reset", { display_name: account.display_name });
    revalidatePath("/pos/settings");
    if (!signedOut) {
      return fail("The password was changed, but the account could not be signed out of its devices. Press Sign out everywhere.");
    }
    return ok(undefined);
  });
}

export async function signOutCounterEverywhereAction(id: unknown): Promise<ActionResult> {
  return runPosAction("accounts.manage", async (owner) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return fail("That counter account was not found.");
    const account = await findCounterAccount(parsed.data);
    if (!account) return fail("That counter account was not found.");
    if (!(await endSessions(account.id))) return fail("Could not sign the account out. Try again.");
    await logAccountChange(owner, account.id, "account_signed_out_everywhere", { display_name: account.display_name });
    return ok(undefined);
  });
}

// Deactivating also signs the account out everywhere at once.
export async function setCounterActiveAction(id: unknown, active: unknown): Promise<ActionResult> {
  return runPosAction("accounts.manage", async (owner) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success || typeof active !== "boolean") return fail("That counter account was not found.");
    const account = await findCounterAccount(parsed.data);
    if (!account) return fail("That counter account was not found.");

    const { error } = await createSupabaseAdminClient().from("profiles").update({ active }).eq("id", account.id);
    if (error) return fail("Could not save. Try again.");
    // Reactivating has no sessions to end.
    const signedOut = active ? true : await endSessions(account.id);
    await logAccountChange(owner, account.id, active ? "account_reactivated" : "account_deactivated", {
      display_name: account.display_name,
    });
    revalidatePath("/pos/settings");
    if (!signedOut) {
      // The account is already locked out of the POS (inactive), but its sign-ins were not ended.
      return fail("The account was deactivated, but it could not be signed out of its devices. Press Sign out everywhere.");
    }
    return ok(undefined);
  });
}

// Removes every row created by the sample seed (sales, appointments,
// customers, staff, offers, gallery), keeping the service list unless asked.
export async function removeSampleDataAction(keepCatalog: unknown): Promise<ActionResult<Record<string, number>>> {
  return runPosAction("settings.edit", async () => {
    if (typeof keepCatalog !== "boolean") return fail("Choose whether to keep the services.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("remove_sample_data", { p_keep_catalog: keepCatalog });
    if (error) return fail(dbErrorMessage(error, "remove_sample_data"));
    revalidatePath("/pos", "layout");
    return ok((data ?? {}) as Record<string, number>);
  });
}
