"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { staffInputSchema } from "@/lib/staff/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Staff management (spec 05), owner only. Every action checks the role on the
// server first (runPosAction), validates its input, and writes through the
// owner's own session, so RLS applies too. Archiving and restoring are logged
// in audit_log by a database trigger.

const idSchema = z.uuid();

// Details go to the server log only; the owner sees a plain message.
function logError(context: string, error: { message: string } | null) {
  if (error) console.error(`staff: ${context}`, error.message);
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

async function removePhoto(path: string | null | undefined) {
  if (!path) return;
  const supabase = await createSupabaseServerClient();
  // Best effort: an orphaned file costs a few kilobytes, never data.
  const { error } = await supabase.storage.from("staff").remove([path]);
  if (error) console.error("Could not remove an old staff photo", error.message);
}

export async function saveStaffAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runPosAction("catalog.edit", async () => {
    const parsed = staffInputSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const values = parsed.data;
    const supabase = await createSupabaseServerClient();

    const row = {
      name: values.name,
      title: values.title,
      phone: values.phone,
      bio: values.bio,
      photo_path: values.photoPath,
      show_on_website: values.showOnWebsite,
      bookable_online: values.bookableOnline,
      sort_order: values.sortOrder,
    };

    if (values.id) {
      const { data: previous } = await supabase.from("staff").select("photo_path").eq("id", values.id).maybeSingle();
      if (!previous) return fail("That staff member was not found.");
      const { error } = await supabase.from("staff").update(row).eq("id", values.id);
      logError("update", error);
      if (error) return fail("Could not save. Check the internet connection and try again.");
      if (previous.photo_path && previous.photo_path !== values.photoPath) await removePhoto(previous.photo_path);
      revalidatePath("/pos/staff");
      return ok({ id: values.id });
    }

    const { data, error } = await supabase.from("staff").insert(row).select("id").single();
    logError("insert", error);
    if (error || !data) return fail("Could not save. Check the internet connection and try again.");
    revalidatePath("/pos/staff");
    return ok({ id: data.id });
  });
}

// "Remove" = archive: hidden from New sale and booking; history stays.
export async function archiveStaffAction(id: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return fail("That staff member was not found.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("staff")
      .update({ active: false, archived_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("active", true)
      .select("id");
    logError("archive", error);
    if (error) return fail("Could not remove. Try again.");
    if (!data?.length) return fail("That staff member was already removed.");
    revalidatePath("/pos/staff");
    return ok(undefined);
  });
}

export async function restoreStaffAction(id: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return fail("That staff member was not found.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("staff")
      .update({ active: true, archived_at: null })
      .eq("id", parsed.data)
      .eq("active", false)
      .select("id");
    logError("restore", error);
    if (error) return fail("Could not restore. Try again.");
    if (!data?.length) return fail("That staff member is already active.");
    revalidatePath("/pos/staff");
    return ok(undefined);
  });
}

// Permanent delete: only for an archived staff member with no sales and no
// bookings at all. (The database refuses it anyway if history exists.)
export async function deleteStaffAction(id: unknown): Promise<ActionResult> {
  return runPosAction("catalog.edit", async () => {
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return fail("That staff member was not found.");
    const supabase = await createSupabaseServerClient();

    const { data: member } = await supabase.from("staff").select("active, photo_path").eq("id", parsed.data).maybeSingle();
    if (!member) return fail("That staff member was not found.");
    if (member.active) return fail("Remove this staff member first.");

    const [items, appointments] = await Promise.all([
      supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("staff_id", parsed.data),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("staff_id", parsed.data),
    ]);
    if ((items.count ?? 1) > 0 || (appointments.count ?? 1) > 0) {
      return fail("This staff member has sales or bookings, so they stay archived to keep the history.");
    }

    const { error } = await supabase.from("staff").delete().eq("id", parsed.data);
    logError("delete", error);
    if (error) return fail("Could not delete. They may have history; they stay archived.");
    await removePhoto(member.photo_path);
    revalidatePath("/pos/staff");
    return ok(undefined);
  });
}
