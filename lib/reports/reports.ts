import "server-only";

import { z } from "zod";

import type { Database } from "@/lib/database.types";
import type { DateRange } from "@/lib/reports/range";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

// Typed wrappers for the report functions in Postgres (spec 14). Every number
// on the Dashboard, the Reports pages, the CSV files, and the day report comes
// from these, so they always agree. The database checks the role (owner only,
// except the day report after a close); these check the shape of the answer.
//
// Like a Spring repository: one method per query, typed results, no logic.
// Money is integer pesewas.

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const int = z.number().int();
const money = z.number().int();
const method = z.enum(["cash", "momo", "card", "other"]);
const channel = z.enum(["walk_in", "online_booking", "phone_booking"]);

export class ReportError extends Error {
  constructor(
    readonly report: string,
    readonly code: string,
    readonly detail: string | null,
  ) {
    super(`${report} failed: ${code}`);
    this.name = "ReportError";
  }
}

// Only the report functions; a typo in a name fails to compile.
type ReportFunction = Extract<keyof Database["public"]["Functions"], `report_${string}`>;

async function call<T>(supabase: Supabase, fn: ReportFunction, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  // One helper for every report, so rpc() is called with a plain name; the
  // result is checked by the schema instead of the generated types.
  const { data, error } = await (supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown;
    error: { message: string; details?: string | null } | null;
  }>)(fn, args);
  if (error) throw new ReportError(fn, error.message, error.details ?? null);
  return schema.parse(data);
}

const rangeArgs = (range: DateRange) => ({ p_from: range.from, p_to: range.to });

// --- report_summary ----------------------------------------------------------

const figuresSchema = z.object({
  revenue: money,
  sales_count: int,
  services_count: int,
  customers_served: int,
  average_sale: money,
  discounts: money,
});
const summarySchema = z.object({
  from: z.string(),
  to: z.string(),
  previous_from: z.string(),
  previous_to: z.string(),
  current: figuresSchema,
  previous: figuresSchema,
});
export type ReportFigures = z.infer<typeof figuresSchema>;
export type ReportSummary = z.infer<typeof summarySchema>;

export function reportSummary(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_summary", rangeArgs(range), summarySchema);
}

// --- breakdowns --------------------------------------------------------------

const byMethodSchema = z.array(z.object({ method, amount: money, sales_count: int }));
export type ReportByMethod = z.infer<typeof byMethodSchema>;
export function reportByPaymentMethod(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_payment_method", rangeArgs(range), byMethodSchema);
}

const byServiceSchema = z.array(
  z.object({
    service_id: z.string().nullable(),
    name: z.string(),
    category: z.string().nullable(),
    custom: z.boolean(),
    times: int,
    revenue: money,
  }),
);
export type ReportByService = z.infer<typeof byServiceSchema>;
export function reportByService(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_service", rangeArgs(range), byServiceSchema);
}

const byCategorySchema = z.array(
  z.object({ category_id: z.string().nullable(), name: z.string(), custom: z.boolean(), times: int, revenue: money }),
);
export type ReportByCategory = z.infer<typeof byCategorySchema>;
export function reportByCategory(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_category", rangeArgs(range), byCategorySchema);
}

const byChannelSchema = z.array(z.object({ channel, sales_count: int, revenue: money }));
export type ReportByChannel = z.infer<typeof byChannelSchema>;
export function reportByChannel(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_channel", rangeArgs(range), byChannelSchema);
}

const byStaffSchema = z.array(
  z.object({
    staff_id: z.string(),
    name: z.string(),
    services: int,
    revenue: money,
    average_per_service: money,
    top_service: z.object({ name: z.string().nullable(), times: int.nullable() }),
  }),
);
export type ReportByStaff = z.infer<typeof byStaffSchema>;
export function reportByStaff(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_staff", rangeArgs(range), byStaffSchema);
}

const byDaySchema = z.array(z.object({ date: z.string(), revenue: money, sales_count: int, services_count: int }));
export type ReportByDay = z.infer<typeof byDaySchema>;
export function reportByDay(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_day", rangeArgs(range), byDaySchema);
}

const byWeekdaySchema = z.array(
  z.object({ weekday: int, name: z.string(), days: int, revenue: money, sales_count: int, services_count: int }),
);
export type ReportByWeekday = z.infer<typeof byWeekdaySchema>;
export function reportByWeekday(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_weekday", rangeArgs(range), byWeekdaySchema);
}

const repeatSchema = z.object({ identified: int, repeat: int, rate: z.number().nullable() });
export type ReportRepeatCustomers = z.infer<typeof repeatSchema>;
export function reportRepeatCustomers(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_repeat_customers", rangeArgs(range), repeatSchema);
}

// --- exceptions and control --------------------------------------------------

const voidsSchema = z.array(
  z.object({
    sale_id: z.string(),
    receipt_no: z.string(),
    paid_at: z.string(),
    business_date: z.string(),
    total: money,
    voided_at: z.string().nullable(),
    voided_by: z.string().nullable(),
    void_reason: z.string().nullable(),
    sold_in_period: z.boolean(),
  }),
);
export type ReportVoids = z.infer<typeof voidsSchema>;
export function reportVoids(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_voids", rangeArgs(range), voidsSchema);
}

const flaggedSaleSchema = z.object({
  sale_id: z.string(),
  receipt_no: z.string(),
  paid_at: z.string(),
  recorded_at: z.string(),
  business_date: z.string(),
  total: money,
  status: z.enum(["paid", "voided"]),
  recorded_by: z.string().nullable(),
});
const backdatedSchema = z.array(flaggedSaleSchema.extend({ sold_in_period: z.boolean() }));
export type ReportBackdated = z.infer<typeof backdatedSchema>;
export function reportBackdated(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_backdated", rangeArgs(range), backdatedSchema);
}

const afterCloseSchema = z.array(flaggedSaleSchema);
export type ReportAfterClose = z.infer<typeof afterCloseSchema>;
export function reportAfterClose(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_after_close", rangeArgs(range), afterCloseSchema);
}

const voidRequestsSchema = z.array(
  z.object({
    id: z.string(),
    sale_id: z.string(),
    receipt_no: z.string(),
    status: z.enum(["pending", "approved", "rejected", "cancelled"]),
    requested_by: z.string().nullable(),
    requested_at: z.string(),
    reason: z.string(),
    decided_by: z.string().nullable(),
    decided_at: z.string().nullable(),
    decision_note: z.string().nullable(),
  }),
);
export type ReportVoidRequests = z.infer<typeof voidRequestsSchema>;
export function reportVoidRequests(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_void_requests", rangeArgs(range), voidRequestsSchema);
}

const byCounterUserSchema = z.array(
  z.object({
    user_id: z.string(),
    name: z.string(),
    role: z.enum(["owner", "counter"]),
    active: z.boolean(),
    sales_count: int,
    revenue: money,
    overrides: int,
    void_requests: int,
  }),
);
export type ReportByCounterUser = z.infer<typeof byCounterUserSchema>;
export function reportByCounterUser(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_by_counter_user", rangeArgs(range), byCounterUserSchema);
}

const dayCloseSchema = z.array(
  z.object({
    id: z.string(),
    business_date: z.string(),
    opening_float: money,
    opening_float_reason: z.string().nullable(),
    expected_cash: money,
    counted_cash: money,
    cash_difference: money,
    momo_reported: money.nullable(),
    expected_momo: money,
    expected_card: money,
    expected_other: money,
    sales_count: int,
    note: z.string().nullable(),
    closed_by: z.string().nullable(),
    closed_at: z.string(),
    active: z.boolean(),
    reopened_by: z.string().nullable(),
    reopened_at: z.string().nullable(),
    reopen_reason: z.string().nullable(),
  }),
);
export type ReportDayClose = z.infer<typeof dayCloseSchema>;
export function reportDayClose(supabase: Supabase, range: DateRange) {
  return call(supabase, "report_day_close", rangeArgs(range), dayCloseSchema);
}

const jsonRecord = z.record(z.string(), z.unknown()).nullable();
const changesSchema = z.object({
  count: int,
  rows: z.array(
    z.object({
      id: int,
      created_at: z.string(),
      actor_name: z.string().nullable(),
      actor_role: z.string(),
      entity: z.string(),
      entity_id: z.string().nullable(),
      action: z.string(),
      before: jsonRecord,
      after: jsonRecord,
      reason: z.string().nullable(),
    }),
  ),
});
export type ReportChanges = z.infer<typeof changesSchema>;
export function reportChanges(supabase: Supabase, range: DateRange, limit = 500) {
  return call(supabase, "report_changes", { ...rangeArgs(range), p_limit: limit }, changesSchema);
}

// --- the day report (Close day download, PC backup) ----------------------------

const daySaleSchema = z.object({
  sale_id: z.string(),
  receipt_no: z.string(),
  paid_at: z.string(),
  status: z.enum(["paid", "voided"]),
  total: money,
  channel,
  customer_name: z.string().nullable(),
  customer_phone: z.string().nullable(),
  is_backdated: z.boolean(),
  after_close: z.boolean(),
  recorded_by: z.string().nullable(),
  items: z.array(z.object({ name: z.string(), quantity: int, line_total: money, staff_name: z.string().nullable() })),
  payments: z.array(z.object({ method, kind: z.enum(["payment", "adjustment"]), amount: money })),
});
const dayReportSchema = z.object({
  business_date: z.string(),
  studio_name: z.string().nullable(),
  generated_at: z.string(),
  figures: figuresSchema,
  by_payment_method: byMethodSchema,
  by_staff: byStaffSchema,
  by_service: byServiceSchema,
  by_channel: byChannelSchema,
  sales: z.array(daySaleSchema),
  voids: voidsSchema,
  backdated: backdatedSchema,
  after_close: afterCloseSchema,
  void_requests: voidRequestsSchema,
  day_closes: dayCloseSchema,
});
export type DayReport = z.infer<typeof dayReportSchema>;

// The owner: any day. A counter user: only a day that has been closed (the
// database raises "not_closed" otherwise).
export function reportDayCloseExport(supabase: Supabase, businessDate: string) {
  return call(supabase, "report_day_close_export", { p_business_date: businessDate }, dayReportSchema);
}

// Percent change from the previous period, rounded to one decimal; null when
// there is nothing to compare with.
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// The schemas, for tests that check them against real database output.
export const reportSchemas = {
  summary: summarySchema,
  byPaymentMethod: byMethodSchema,
  byService: byServiceSchema,
  byCategory: byCategorySchema,
  byChannel: byChannelSchema,
  byStaff: byStaffSchema,
  byDay: byDaySchema,
  byWeekday: byWeekdaySchema,
  repeatCustomers: repeatSchema,
  voids: voidsSchema,
  backdated: backdatedSchema,
  afterClose: afterCloseSchema,
  voidRequests: voidRequestsSchema,
  byCounterUser: byCounterUserSchema,
  dayClose: dayCloseSchema,
  changes: changesSchema,
  dayReport: dayReportSchema,
};
