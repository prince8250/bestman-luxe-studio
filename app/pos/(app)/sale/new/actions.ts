"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { normalizePhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// New sale (spec 08). The browser sends what the counter chose; the server
// never trusts its prices or totals. create_sale re-reads every service price,
// checks the staff, the discount limit, the reasons, and that the payments add
// up, and saves the sale, its lines, its payments, and the customer in one
// transaction (or nothing at all).

const money = z.number().int().min(0).max(100_000_000);

const saleSchema = z.object({
  clientRequestId: z.uuid(),
  customerPhone: z.string().trim().max(30).nullable(),
  customerName: z.string().trim().max(80).nullable(),
  appointmentId: z.uuid().nullable(),
  lines: z
    .array(
      z.object({
        serviceId: z.uuid().nullable(),
        itemName: z.string().trim().max(80).nullable(),
        staffId: z.uuid().nullable(),
        unitPrice: money,
        quantity: z.number().int().min(1).max(20),
        reason: z.string().trim().max(300).nullable(),
      }),
    )
    .min(1, "Add a service to start.")
    .max(30, "A sale can have at most 30 lines."),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "momo", "card", "other"]),
        amount: money.min(1),
        tendered: money.nullable(),
        reference: z.string().trim().max(60).nullable(),
      }),
    )
    .max(4, "Use at most 4 payments."),
});

export interface ConfirmedSale {
  saleId: string;
  receiptNo: string;
  total: number;
  afterClose: boolean;
  existing: boolean;
}

export async function confirmSaleAction(input: unknown): Promise<ActionResult<ConfirmedSale>> {
  return runPosAction("sale.create", async () => {
    const parsed = saleSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the sale and try again.");
    const sale = parsed.data;

    let phone: string | null = null;
    if (sale.customerPhone) {
      phone = normalizePhone(sale.customerPhone);
      if (!phone) return fail("The customer's phone number is not valid. Fix it or leave it empty.");
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_sale", {
      payload: {
        client_request_id: sale.clientRequestId,
        customer_phone: phone,
        customer_name: sale.customerName,
        appointment_id: sale.appointmentId,
        items: sale.lines.map((line) => ({
          service_id: line.serviceId,
          item_name: line.itemName,
          staff_id: line.staffId,
          unit_price: line.unitPrice,
          quantity: line.quantity,
          price_override_reason: line.reason,
        })),
        payments: sale.payments.map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          tendered: payment.tendered,
          reference: payment.reference,
        })),
      },
    });
    if (error || !data) return fail(dbErrorMessage(error ?? { message: "no_sale" }, "create_sale"));

    const result = data as { sale_id: string; receipt_no: string; total: number; after_close: boolean; existing: boolean };
    revalidatePath("/pos/today");
    revalidatePath("/pos/sales");
    return ok({
      saleId: result.sale_id,
      receiptNo: result.receipt_no,
      total: result.total,
      afterClose: result.after_close,
      existing: result.existing,
    });
  });
}

export interface CustomerMatch {
  found: boolean;
  name: string | null;
  visits: number;
  lastVisit: string | null;
  blocked: boolean;
  blockedReason: string | null;
}

// Live lookup while the counter types a phone number. Visit counts only, no money.
export async function lookupCustomerAction(rawPhone: unknown): Promise<ActionResult<CustomerMatch>> {
  return runPosAction("sale.create", async () => {
    const phone = typeof rawPhone === "string" ? normalizePhone(rawPhone) : null;
    if (!phone) return fail("Not a valid phone number yet.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("customer_lookup", { p_phone: phone });
    if (error || !data) return fail(dbErrorMessage(error ?? { message: "no_result" }, "customer_lookup"));
    const match = data as {
      found: boolean;
      full_name?: string | null;
      visits?: number;
      last_visit?: string | null;
      blocked?: boolean;
      blocked_reason?: string | null;
    };
    return ok({
      found: match.found,
      name: match.full_name ?? null,
      visits: match.visits ?? 0,
      lastVisit: match.last_visit ?? null,
      blocked: match.blocked ?? false,
      blockedReason: match.blocked_reason ?? null,
    });
  });
}
