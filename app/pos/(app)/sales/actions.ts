"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Voids and void requests (spec 10). Each action checks the role first
// (runPosAction), then the Postgres function checks it again and does the
// work in one transaction: void_sale and decide_void_request are owner-only,
// request_void and cancel_void_request are counter-only.

const id = z.uuid();
const reason = z.string().trim().min(1, "Give a reason.").max(500, "Keep the reason under 500 characters.");
const note = z.string().trim().max(500, "Keep the note under 500 characters.");

function refresh() {
  // The sales list, the sale pages, and the void requests list.
  revalidatePath("/pos/sales", "layout");
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
