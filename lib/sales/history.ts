import { z } from "zod";

import { normalizePhone } from "@/lib/phone";
import { classifyFindQuery } from "@/lib/pos/find";
import { addDays, startOfMonth, startOfWeek } from "@/lib/time";

// Sales history (spec 10): the URL filters of /pos/sales, turned into the
// filters public.search_sales understands, and the shapes it returns.

export const PAGE_SIZE = 50;

export const RANGE_PRESETS = ["today", "yesterday", "week", "month", "30d", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];
export const RANGE_LABEL: Record<RangePreset, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  month: "This month",
  "30d": "Last 30 days",
  custom: "Custom dates",
};

export const METHODS = ["cash", "momo", "card", "other"] as const;
export const METHOD_LABEL: Record<(typeof METHODS)[number], string> = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" };
export const CHANNELS = ["walk_in", "online_booking", "phone_booking"] as const;
export const CHANNEL_LABEL: Record<(typeof CHANNELS)[number], string> = {
  walk_in: "Walk-in",
  online_booking: "Online booking",
  phone_booking: "Phone booking",
};
export const STATUSES = ["paid", "voided", "void_requested"] as const;
export const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  paid: "Paid",
  voided: "Voided",
  void_requested: "Void requested",
};

/** What the filter form shows (all strings, "" = not set). */
export interface SalesFilterValues {
  range: RangePreset;
  from: string;
  to: string;
  staff: string;
  method: string;
  channel: string;
  status: string;
  by: string;
  q: string;
}

export interface SalesQuery {
  values: SalesFilterValues;
  /** Sent to public.search_sales. */
  filters: Record<string, string | number>;
  page: number;
  /** The searched text is not a receipt number or phone number. */
  searchError: string | null;
  /** The business dates covered ("from" and "to"), or null when searching all dates. */
  dates: { from: string; to: string } | null;
}

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const uuid = z.uuid();

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function pick<T extends readonly string[]>(value: string, allowed: T): T[number] | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : "";
}

// A receipt number ("BLS-000213", "bls213", or just "213") or a phone number.
export function parseSalesSearch(text: string): { receipt_no: string } | { phone: string } | { error: string } {
  const query = classifyFindQuery(text);
  if (query.kind === "receipt") return { receipt_no: query.value };
  const digits = text.replace(/[\s-]/g, "");
  if (/^\d{1,7}$/.test(digits)) return { receipt_no: `BLS-${digits.padStart(6, "0")}` };
  const phone = normalizePhone(text);
  if (phone) return { phone };
  return { error: "Type a receipt number (BLS-000123) or a phone number." };
}

export function datesFor(range: RangePreset, today: string, from: string, to: string): { from: string; to: string } {
  switch (range) {
    case "yesterday":
      return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week":
      return { from: startOfWeek(today), to: today };
    case "month":
      return { from: startOfMonth(today), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "custom": {
      const start = isoDate.test(from) ? from : today;
      const end = isoDate.test(to) ? to : start;
      return start <= end ? { from: start, to: end } : { from: end, to: start };
    }
    default:
      return { from: today, to: today };
  }
}

// Reads /pos/sales?range=week&staff=...&page=2 into the search_sales filters.
// A receipt or phone search looks across all dates.
export function parseSalesQuery(params: Record<string, string | string[] | undefined>, today: string): SalesQuery {
  const range = pick(one(params.range), RANGE_PRESETS) || "today";
  const values: SalesFilterValues = {
    range,
    from: isoDate.test(one(params.from)) ? one(params.from) : "",
    to: isoDate.test(one(params.to)) ? one(params.to) : "",
    staff: uuid.safeParse(one(params.staff)).success ? one(params.staff) : "",
    method: pick(one(params.method), METHODS),
    channel: pick(one(params.channel), CHANNELS),
    status: pick(one(params.status), STATUSES),
    by: uuid.safeParse(one(params.by)).success ? one(params.by) : "",
    q: one(params.q).slice(0, 40),
  };
  const page = Math.min(Math.max(Number.parseInt(one(params.page), 10) || 1, 1), 1000);

  const filters: Record<string, string | number> = { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE };
  if (values.staff) filters.staff_id = values.staff;
  if (values.method) filters.method = values.method;
  if (values.channel) filters.channel = values.channel;
  if (values.status) filters.status = values.status;
  if (values.by) filters.recorded_by = values.by;

  let searchError: string | null = null;
  let dates: SalesQuery["dates"] = null;
  if (values.q) {
    const search = parseSalesSearch(values.q);
    if ("error" in search) searchError = search.error;
    else Object.assign(filters, search);
  }
  if (!values.q || searchError) {
    dates = datesFor(range, today, values.from, values.to);
    filters.from = dates.from;
    filters.to = dates.to;
  }
  return { values, filters, page, searchError, dates };
}

// Builds a /pos/sales link that keeps the current filters, with some changed.
export function salesHref(values: SalesFilterValues, changes: Partial<SalesFilterValues> & { page?: number } = {}): string {
  const { page, ...rest } = changes;
  const merged = { ...values, ...rest };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (!value || (key === "range" && value === "today")) continue;
    if ((key === "from" || key === "to") && merged.range !== "custom") continue;
    params.set(key, value);
  }
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/pos/sales?${query}` : "/pos/sales";
}

const methodSchema = z.enum(METHODS);

const saleRowSchema = z.object({
  id: z.string(),
  receipt_no: z.string(),
  paid_at: z.string(),
  recorded_at: z.string(),
  status: z.enum(["paid", "voided"]),
  void_requested: z.boolean(),
  total: z.number().int().nullable(),
  customer_name: z.string().nullable(),
  customer_phone: z.string().nullable(),
  channel: z.enum(CHANNELS),
  is_backdated: z.boolean(),
  after_close: z.boolean(),
  recorded_by: z.string().nullable(),
  items: z.array(z.object({ name: z.string(), quantity: z.number().int(), staff_name: z.string().nullable() })),
  methods: z.array(methodSchema),
});

const searchResultSchema = z.object({
  count: z.number().int(),
  rows: z.array(saleRowSchema),
  totals: z
    .object({
      sales: z.number().int(),
      revenue: z.number().int(),
      discounts: z.number().int(),
      voided: z.number().int(),
      voided_amount: z.number().int(),
      by_method: z.record(z.string(), z.number().int()),
    })
    .nullable(),
});

export type SaleRow = z.infer<typeof saleRowSchema>;
export type SalesSearchResult = z.infer<typeof searchResultSchema>;

export function parseSearchResult(value: unknown): SalesSearchResult {
  return searchResultSchema.parse(value);
}

const voidRequestSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]),
  reason: z.string(),
  requested_by: z.string().nullable(),
  mine: z.boolean(),
  created_at: z.string(),
  decided_by: z.string().nullable(),
  decided_at: z.string().nullable(),
  decision_note: z.string().nullable(),
});

const historySchema = z.object({
  action: z.string(),
  actor_name: z.string().nullable(),
  actor_role: z.string(),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  reason: z.string().nullable(),
  created_at: z.string(),
});

const saleDetailSchema = z.object({
  id: z.string(),
  receipt_no: z.string(),
  status: z.enum(["paid", "voided"]),
  channel: z.enum(CHANNELS),
  paid_at: z.string(),
  recorded_at: z.string(),
  business_date: z.string(),
  is_backdated: z.boolean(),
  after_close: z.boolean(),
  subtotal: z.number().int(),
  discount_total: z.number().int(),
  total: z.number().int(),
  note: z.string().nullable(),
  customer_id: z.string().nullable(),
  customer_name: z.string().nullable(),
  customer_phone: z.string().nullable(),
  recorded_by: z.string().nullable(),
  voided_at: z.string().nullable(),
  voided_by: z.string().nullable(),
  void_reason: z.string().nullable(),
  prints: z.number().int(),
  lines: z.array(
    z.object({
      id: z.string(),
      line_no: z.number().int(),
      name: z.string(),
      custom: z.boolean(),
      quantity: z.number().int(),
      list_price: z.number().int(),
      unit_price: z.number().int(),
      line_total: z.number().int(),
      reason: z.string().nullable(),
      staff_name: z.string().nullable(),
    }),
  ),
  payments: z.array(
    z.object({
      kind: z.enum(["payment", "adjustment"]),
      method: methodSchema,
      amount: z.number().int(),
      tendered: z.number().int().nullable(),
      reference: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
  appointment: z
    .object({
      code: z.string(),
      starts_at: z.string(),
      source: z.string(),
      service_name: z.string().nullable(),
      staff_name: z.string().nullable(),
    })
    .nullable(),
  void_requests: z.array(voidRequestSchema),
  history: z.array(historySchema).nullable(),
});

export type SaleDetail = z.infer<typeof saleDetailSchema>;
export type VoidRequest = z.infer<typeof voidRequestSchema>;
export type HistoryEntry = z.infer<typeof historySchema>;

export function parseSaleDetail(value: unknown): SaleDetail {
  return saleDetailSchema.parse(value);
}
