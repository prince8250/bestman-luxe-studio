"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { dbErrorMessage } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { PAPER_COOKIE, parsePaper, type Paper } from "@/lib/receipt/receipt";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Records one print of a receipt and returns its number (1 = the original).
// Every later print of the same sale shows REPRINT.
export async function recordReceiptPrintAction(saleId: string): Promise<ActionResult<number>> {
  return runPosAction("sale.reprint", async () => {
    const parsed = z.uuid().safeParse(saleId);
    if (!parsed.success) return fail("That receipt was not found.");

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("record_receipt_print", { p_sale_id: parsed.data });
    if (error) return fail(dbErrorMessage(error, "The print could not be recorded."));
    return ok(data);
  });
}

// Remembers which paper this device prints on (a cookie, so the server lays
// the receipt out for it). Setting a cookie re-renders the page.
export async function choosePaperAction(paper: Paper): Promise<ActionResult> {
  return runPosAction("sale.reprint", async () => {
    (await cookies()).set(PAPER_COOKIE, parsePaper(paper), {
      path: "/pos",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return ok(undefined);
  });
}
