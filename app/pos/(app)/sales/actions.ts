"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { sendOwnerAlertsLater } from "@/lib/alerts/send";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Voids and void requests (spec 10). Each action checks the role first
// (runPosAction), then the Postgres function checks it again and does the
// work in one transaction: void_sale and decide_void_request are owner-only,
// request_void and cancel_void_request are counter-only.

const id = z.uuid();
const reason = z.string().trim().min(1, "Give a reason.").max(500, "Keep the reason under 500 characters.");
const note = z.string().trim().max(500, "Keep the note under 500 characters.");

function refresh() {
  // The sales list, the sale pages, the void requests list, and the owner's
  // activity feed (where requests are approved from a phone).
  revalidatePath("/pos/sales", "layout");
  revalidatePath("/pos/activity");
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function voidSaleAction(saleId: string, rawReason: string): Promise<ActionResult> {
  return runPosAction("sale.void", async () => {
    const parsed = z.object({ saleId: id, reason }).safeParse({ saleId, reason: rawReason });
    if (!parsed.success) return fail(firstIssue(parsed.error));

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("void_sale", { p_sale_id: parsed.data.saleId, p_reason: parsed.data.reason });
    if (error) return fail(dbErrorMessage(error, "void_sale failed"));
    refresh();
    return ok(undefined);
  });
}

export async function requestVoidAction(saleId: string, rawReason: string): Promise<ActionResult> {
  return runPosAction("sale.requestVoid", async () => {
    const parsed = z.object({ saleId: id, reason }).safeParse({ saleId, reason: rawReason });
    if (!parsed.success) return fail(firstIssue(parsed.error));

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("request_void", { p_sale_id: parsed.data.saleId, p_reason: parsed.data.reason });
    if (error) return fail(dbErrorMessage(error, "request_void failed"));
    refresh();
    sendOwnerAlertsLater(); // the owner hears about the request
    return ok(undefined);
  });
}

export async function cancelVoidRequestAction(requestId: string): Promise<ActionResult> {
  return runPosAction("sale.requestVoid", async () => {
    const parsed = id.safeParse(requestId);
    if (!parsed.success) return fail("That void request was not found.");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("cancel_void_request", { p_request_id: parsed.data });
    if (error) return fail(dbErrorMessage(error, "cancel_void_request failed"));
    refresh();
    return ok(undefined);
  });
}

// Spec 11: change who did a line. Counter: today's sales only; owner: any
// day (reassign_sale_item_staff checks the window again). The total, the
// receipt number, and the payments never change.
export async function reassignStaffAction(itemId: string, staffId: string, rawReason: string): Promise<ActionResult> {
  return runPosAction("sale.reassignToday", async () => {
    const parsed = z.object({ itemId: id, staffId: id, reason }).safeParse({ itemId, staffId, reason: rawReason });
    if (!parsed.success) return fail(firstIssue(parsed.error));

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("reassign_sale_item_staff", {
      p_item_id: parsed.data.itemId,
      p_new_staff_id: parsed.data.staffId,
      p_reason: parsed.data.reason,
    });
    if (error) return fail(dbErrorMessage(error, "reassign_sale_item_staff failed"));
    refresh();
    return ok(undefined);
  });
}

const editSchema = z.object({
  itemId: id,
  serviceId: id.nullable(),
  unitPrice: z.number().int().min(0).max(100_000_000),
  quantity: z.number().int().min(1).max(20),
  reason,
  adjustment: z
    .object({
      method: z.enum(["cash", "momo", "card", "other"]),
      amount: z.number().int().min(-100_000_000).max(100_000_000),
      reference: z.string().trim().max(60),
    })
    .nullable(),
});

// Spec 11, owner only: change a paid line's service, price, or quantity.
// When the total changes, the money collected or refunded is recorded in the
// same transaction (edit_sale_item checks it equals the difference exactly).
export async function editSaleItemAction(input: z.input<typeof editSchema>): Promise<ActionResult> {
  return runPosAction("sale.editPaid", async () => {
    const parsed = editSchema.safeParse(input);
    if (!parsed.success) return fail(firstIssue(parsed.error));
    const { itemId, serviceId, unitPrice, quantity, adjustment } = parsed.data;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("edit_sale_item", {
      p_item_id: itemId,
      p_changes: { ...(serviceId ? { service_id: serviceId } : {}), unit_price: unitPrice, quantity },
      // null: the total does not change, so no money moves.
      p_payment_adjustment: adjustment,
      p_reason: parsed.data.reason,
    });
    if (error) return fail(dbErrorMessage(error, "edit_sale_item failed"));
    refresh();
    return ok(undefined);
  });
}

export async function decideVoidRequestAction(requestId: string, approve: boolean, rawNote: string): Promise<ActionResult> {
  return runPosAction("sale.decideVoid", async () => {
    const parsed = z.object({ requestId: id, approve: z.boolean(), note }).safeParse({ requestId, approve, note: rawNote });
    if (!parsed.success) return fail(firstIssue(parsed.error));
    if (!parsed.data.approve && !parsed.data.note) return fail("Say why the request is rejected.");

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("decide_void_request", {
      p_request_id: parsed.data.requestId,
      p_approve: parsed.data.approve,
      p_note: parsed.data.note,
    });
    if (error) return fail(dbErrorMessage(error, "decide_void_request failed"));
    refresh();
    return ok(undefined);
  });
}
