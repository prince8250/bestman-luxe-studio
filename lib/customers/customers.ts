import { z } from "zod";

import { normalizePhone } from "@/lib/phone";

// Customers (spec 13): the /pos/customers search, and the shapes returned by
// public.search_customers and public.customer_detail.

export const CUSTOMERS_PAGE_SIZE = 50;

// A full phone number in any common Ghana format is matched exactly (as
// E.164); anything else matches part of a name or part of a number.
export function customerSearch(text: string): { p_query?: string; p_phone?: string } {
  const query = text.trim().slice(0, 80);
  if (!query) return {};
  const phone = normalizePhone(query);
  return phone ? { p_phone: phone } : { p_query: query };
}

const rowSchema = z.object({
  id: z.string(),
  phone: z.string(),
  full_name: z.string().nullable(),
  blocked: z.boolean(),
  visits: z.number().int(),
  last_visit: z.string().nullable(),
});

const searchSchema = z.object({ count: z.number().int(), rows: z.array(rowSchema) });

export type CustomerRow = z.infer<typeof rowSchema>;
export type CustomerSearchResult = z.infer<typeof searchSchema>;

export function parseCustomerSearch(value: unknown): CustomerSearchResult {
  return searchSchema.parse(value);
}

const detailSchema = z.object({
  id: z.string(),
  phone: z.string(),
  full_name: z.string().nullable(),
  notes: z.string().nullable(),
  blocked: z.boolean(),
  blocked_reason: z.string().nullable(),
  blocked_by: z.object({ name: z.string().nullable(), at: z.string() }).nullable(),
  created_at: z.string(),
  stats: z.object({
    visits: z.number().int(),
    first_visit: z.string().nullable(),
    last_visit: z.string().nullable(),
    /** Owner only; null for the counter. */
    total_spent: z.number().int().nullable(),
  }),
  favorite_service: z.object({ name: z.string(), times: z.number().int() }).nullable(),
  usual_staff: z.object({ name: z.string(), times: z.number().int() }).nullable(),
  sales: z.array(
    z.object({
      id: z.string(),
      receipt_no: z.string(),
      paid_at: z.string(),
      status: z.enum(["paid", "voided"]),
      total: z.number().int().nullable(),
      can_open: z.boolean(),
      items: z.array(z.object({ name: z.string(), quantity: z.number().int(), staff_name: z.string().nullable() })),
    }),
  ),
  appointments: z.array(
    z.object({
      id: z.string(),
      code: z.string(),
      starts_at: z.string(),
      status: z.enum(["confirmed", "arrived", "cancelled", "no_show"]),
      source: z.string(),
      service_name: z.string().nullable(),
      staff_name: z.string().nullable(),
    }),
  ),
});

export type CustomerDetail = z.infer<typeof detailSchema>;

export function parseCustomerDetail(value: unknown): CustomerDetail {
  return detailSchema.parse(value);
}

// Both roles edit the name and notes; the phone number is the identity.
export const customerEditSchema = z.object({
  fullName: z.string().trim().max(80, "Keep the name under 80 characters."),
  notes: z.string().trim().max(1000, "Keep the notes under 1,000 characters."),
});

export const APPOINTMENT_STATUS_LABEL: Record<CustomerDetail["appointments"][number]["status"], string> = {
  confirmed: "Booked",
  arrived: "Arrived",
  cancelled: "Cancelled",
  no_show: "No-show",
};
