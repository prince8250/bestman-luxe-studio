import { formatGhs } from "@/lib/money";
import { describeHistory } from "@/lib/sales/describe";

// The change log (spec 16): the types the owner filters by, one plain
// sentence per audit_log row, and where each row links to.

export const CHANGE_TYPES = {
  reassignments: { label: "Staff reassignments", actions: ["staff_reassigned"] },
  edits: { label: "Edits after payment", actions: ["item_price_changed", "item_service_changed"] },
  voids: {
    label: "Voids and void requests",
    actions: ["sale_voided", "void_requested", "void_request_approved", "void_request_rejected", "void_request_cancelled"],
  },
  backdated: { label: "Past sales", actions: ["sale_backdated"] },
  overrides: { label: "Price overrides at the counter", actions: ["item_price_overridden"] },
  prices: { label: "Service price changes", actions: ["service_price_changed"] },
  appointments: { label: "Appointment cancellations and no-shows", actions: ["appointment_cancelled", "appointment_no_show"] },
  days: { label: "Day closes", actions: ["day_closed", "day_reopened"] },
  accounts: {
    label: "Counter accounts",
    actions: [
      "account_created",
      "account_password_reset",
      "account_signed_out_everywhere",
      "account_deactivated",
      "account_reactivated",
    ],
  },
  catalog: { label: "Staff, services, and settings", actions: ["staff_archived", "staff_restored", "service_archived", "service_restored", "settings_changed"] },
  customers: { label: "Customers blocked or unblocked", actions: ["customer_blocked", "customer_unblocked"] },
} as const;

export type ChangeType = keyof typeof CHANGE_TYPES;

export function isChangeType(value: string): value is ChangeType {
  return Object.prototype.hasOwnProperty.call(CHANGE_TYPES, value);
}

export interface ChangeRow {
  action: string;
  entity: string;
  entity_id: string | null;
  actor_name: string | null;
  actor_role: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function money(value: unknown): string {
  return typeof value === "number" ? formatGhs(value) : "?";
}

const receipt = (row: ChangeRow) => text(row.after?.receipt_no) || text(row.before?.receipt_no);

// One plain sentence, for example "Moved Haircut on BLS-000412 from Kofi to Kwame".
export function describeChange(row: ChangeRow): string {
  const before = row.before ?? {};
  const after = row.after ?? {};
  const on = receipt(row) ? ` on ${receipt(row)}` : "";
  switch (row.action) {
    case "staff_reassigned":
    case "item_price_changed":
    case "item_service_changed":
    case "item_price_overridden":
      return `${describeHistory({ ...row, before: row.before, after: row.after })}${on}`;
    case "sale_voided":
      return `Voided ${text(before.receipt_no) || "a sale"} (${money(before.total)})`;
    case "sale_backdated":
      return `Recorded ${text(after.receipt_no) || "a past sale"} (${money(after.total)}) as a past sale`;
    case "void_requested":
      return `Asked to void ${text(after.receipt_no) || "a sale"}`;
    case "void_request_approved":
      return "Approved a void request";
    case "void_request_rejected":
      return "Rejected a void request";
    case "void_request_cancelled":
      return "Withdrew a void request";
    case "service_price_changed":
      return `Changed the price of ${text(after.name) || text(before.name) || "a service"} from ${money(before.price)} to ${money(after.price)}`;
    case "service_archived":
      return `Removed the service ${text(before.name) || text(after.name)}`;
    case "service_restored":
      return `Restored the service ${text(after.name) || text(before.name)}`;
    case "staff_archived":
      return `Removed ${text(before.name) || text(after.name) || "a staff member"} from the staff list`;
    case "staff_restored":
      return `Restored ${text(after.name) || text(before.name) || "a staff member"} to the staff list`;
    case "settings_changed":
      return `Changed settings: ${Object.keys(after).join(", ") || "studio settings"}`;
    case "customer_blocked":
      return `Blocked ${text(after.phone) || "a number"} for online booking`;
    case "customer_unblocked":
      return `Unblocked ${text(after.phone) || "a number"} for online booking`;
    case "appointment_cancelled":
      return `Cancelled appointment ${text(after.code) || text(before.code)}`.trim();
    case "appointment_no_show":
      return `Marked appointment ${text(after.code) || text(before.code)} as a no-show`.trim();
    case "appointment_created":
      return `Booked appointment ${text(after.code)}`.trim();
    case "day_closed":
      return `Closed ${text(after.business_date)}: counted ${money(after.counted_cash)}, expected ${money(after.expected_cash)}`;
    case "day_reopened":
      return `Reopened ${text(after.business_date) || text(before.business_date)}`;
    case "account_created":
      return `Created the counter account ${text(after.display_name)}`;
    case "account_password_reset":
      return `Set a new password for ${text(after.display_name)}`;
    case "account_signed_out_everywhere":
      return `Signed ${text(after.display_name)} out everywhere`;
    case "account_deactivated":
      return `Deactivated ${text(after.display_name)}`;
    case "account_reactivated":
      return `Reactivated ${text(after.display_name)}`;
    case "sample_data_removed":
      return "Removed the sample data";
    default:
      return row.action.replaceAll("_", " ");
  }
}

// Where a row can be looked at (null when there is no page for it).
export function changeLink(row: ChangeRow): string | null {
  const saleId = text(row.after?.sale_id) || text(row.before?.sale_id);
  if (row.entity === "sale" && row.entity_id) return `/pos/sales/${row.entity_id}`;
  if ((row.entity === "sale_item" || row.entity === "void_request") && saleId) return `/pos/sales/${saleId}`;
  if (row.entity === "customer" && row.entity_id) return `/pos/customers/${row.entity_id}`;
  if (row.entity === "service") return "/pos/services";
  if (row.entity === "staff") return "/pos/staff";
  if (row.entity === "settings") return "/pos/settings";
  return null;
}
