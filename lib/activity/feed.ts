import { formatGhs } from "@/lib/money";
import { changeLink, describeChange } from "@/lib/reports/changes";

// The owner's activity feed (spec 19): the filter types and one plain
// sentence per event, for example "Abena moved Haircut from Kofi to Kwame on
// BLS-000412". The events come from public.activity_feed.

export const FEED_TYPES = {
  sales: "All sales",
  custom: "Sales with custom items",
  backdated: "Past sales",
  after_close: "Sales after close",
  overrides: "Price changes at the counter",
  reassignments: "Staff reassignments",
  edits: "Edits after payment",
  void_requests: "Void requests",
  voids: "Voids",
  appointments: "Appointment cancellations and no-shows",
  days: "Day closes and reopens",
  sign_ins: "Counter sign-ins",
  backups: "Failed backups",
} as const;

export type FeedType = keyof typeof FEED_TYPES;

export function isFeedType(value: string): value is FeedType {
  return Object.prototype.hasOwnProperty.call(FEED_TYPES, value);
}

export interface FeedEvent {
  key: string;
  at: string;
  /** "sale", "sign_in", "backup_failed", or the audit_log action. */
  type: string;
  tags: string[];
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string;
  /** Needs a look: void requests, cash differences, big overrides, past and after-close sales, failed backups. */
  unusual: boolean;
  data: Record<string, unknown>;
}

export interface DescribedEvent {
  sentence: string;
  /** A reason or note to show under the sentence. */
  reason: string | null;
  href: string | null;
}

const METHOD: Record<string, string> = { cash: "cash", momo: "MoMo", card: "card", other: "other" };
const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

const str = (value: unknown) => (typeof value === "string" ? value : "");
const record = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});
const day = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? shortDate.format(new Date(`${value}T00:00:00Z`)) : "a day";

function lowerFirst(sentence: string): string {
  return sentence.charAt(0).toLowerCase() + sentence.slice(1);
}

function saleSentence(data: Record<string, unknown>): string {
  const items = Array.isArray(data.items) ? (data.items as Record<string, unknown>[]) : [];
  const parts = items.slice(0, 3).map((item) => {
    const quantity = typeof item.quantity === "number" && item.quantity > 1 ? ` x${item.quantity}` : "";
    const staff = str(item.staff) ? ` (${str(item.staff)})` : "";
    return `${str(item.name)}${quantity}${staff}`;
  });
  if (items.length > 3) parts.push(`${items.length - 3} more`);
  const methods = Array.isArray(data.methods) ? (data.methods as unknown[]).map((method) => METHOD[str(method)] ?? str(method)) : [];
  const total = typeof data.total === "number" ? formatGhs(data.total) : "";
  return `sold ${parts.join(", ") || "a sale"} for ${total}${methods.length ? ` by ${methods.join(" + ")}` : ""}${
    data.status === "voided" ? " (later voided)" : ""
  }`;
}

export function describeFeedEvent(event: FeedEvent): DescribedEvent {
  const who = event.actor_name ?? (event.actor_role === "system" ? "The system" : "Someone");
  const data = event.data;

  if (event.type === "sale") {
    return { sentence: `${who} ${saleSentence(data)}`, reason: null, href: str(data.sale_id) ? `/pos/sales/${str(data.sale_id)}` : null };
  }
  if (event.type === "sign_in") return { sentence: `${who} signed in`, reason: null, href: null };
  if (event.type === "backup_failed") {
    const which = data.kind === "weekly_cloud" ? "weekly cloud backup" : data.kind === "manual_download" ? "backup download" : "PC backup";
    return { sentence: `The ${which} failed`, reason: str(data.message) || null, href: "/pos/backups" };
  }

  const after = record(data.after);
  const before = record(data.before);
  if (event.type === "day_closed") {
    const difference = typeof after.cash_difference === "number" ? after.cash_difference : 0;
    const counted = typeof after.counted_cash === "number" ? formatGhs(after.counted_cash) : "?";
    const expected = typeof after.expected_cash === "number" ? formatGhs(after.expected_cash) : "?";
    const date = str(after.business_date);
    return {
      sentence: `${who} closed ${day(date)}: counted ${counted}, expected ${expected}${
        difference === 0 ? ", no difference" : `, ${difference < 0 ? "short" : "over"} by ${formatGhs(Math.abs(difference))}`
      }`,
      reason: str(data.reason) || null,
      href: date ? `/pos/close-day?date=${date}` : null,
    };
  }
  if (event.type === "day_reopened") {
    const date = str(after.business_date) || str(before.business_date);
    return { sentence: `${who} reopened ${day(date)}`, reason: str(data.reason) || null, href: date ? `/pos/close-day?date=${date}` : null };
  }

  // Every other event is an audit_log row: the change log's sentence.
  const row = {
    action: event.type,
    entity: str(data.entity),
    entity_id: str(data.entity_id) || null,
    actor_name: event.actor_name,
    actor_role: event.actor_role,
    before: data.before ? before : null,
    after: data.after ? after : null,
    reason: str(data.reason) || null,
    created_at: event.at,
  };
  return { sentence: `${who} ${lowerFirst(describeChange(row))}`, reason: row.reason, href: changeLink(row) };
}
