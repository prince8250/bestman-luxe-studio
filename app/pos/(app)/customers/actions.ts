"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { customerEditSchema } from "@/lib/customers/customers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Customers (spec 13). Each is a single-row update, so supabase-js is enough
// here (no Postgres function needed). RLS lets POS users update a customer,
// the column grants allow only the name, notes, and block fields, and the
// customers_guard trigger refuses a phone change and any block by a counter
// user. Blocking and unblocking are logged by the customers_audit trigger.

const id = z.uuid();

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function updateCustomerAction(customerId: string, input: unknown): Promise<ActionResult> {
  return runPosAction("customers.edit", async () => {
    const parsedId = id.safeParse(customerId);
    if (!parsedId.success) return fail("That customer was not found.");
    const parsed = customerEditSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ full_name: parsed.data.fullName || null, notes: parsed.data.notes || null })
      .eq("id", parsedId.data)
      .select("id");
    if (error) return fail(dbErrorMessage(error, "customer update failed"));
    if (data.length === 0) return fail("That customer was not found.");
    revalidatePath("/pos/customers", "layout");
    return ok(undefined);
  });
}

// Owner only: a blocked number cannot book online (spec 34). It can still buy
// at the counter.
export async function setCustomerBlockedAction(customerId: string, blocked: boolean, rawReason: string): Promise<ActionResult> {
  return runPosAction("customers.block", async () => {
    const parsed = z
      .object({ id, blocked: z.boolean(), reason: z.string().trim().max(300, "Keep the reason under 300 characters.") })
      .safeParse({ id: customerId, blocked, reason: rawReason });
    if (!parsed.success) return fail(firstIssue(parsed.error));
    if (parsed.data.blocked && !parsed.data.reason) return fail("Give a reason for blocking the number.");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customers")
      .update({ blocked: parsed.data.blocked, blocked_reason: parsed.data.blocked ? parsed.data.reason : null })
      .eq("id", parsed.data.id)
      .select("id");
    if (error) return fail(dbErrorMessage(error, "customer block failed"));
    if (data.length === 0) return fail("That customer was not found.");
    revalidatePath("/pos/customers", "layout");
    return ok(undefined);
  });
}
