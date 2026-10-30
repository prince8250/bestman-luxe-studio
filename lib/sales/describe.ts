import { formatGhs } from "@/lib/money";
import type { HistoryEntry } from "@/lib/sales/history";

// One plain sentence per change-history row on the sale page (owner only),
// for example "Changed the price of Haircut from GHS 50.00 to GHS 40.00".

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function money(value: unknown): string {
  return typeof value === "number" ? formatGhs(value) : "?";
}

export function describeHistory(entry: HistoryEntry): string {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  switch (entry.action) {
    case "sale_voided":
      return "Voided the sale";
    case "sale_backdated":
      return "Recorded this as a past sale";
    case "item_price_overridden":
      return `Charged ${money(after.unit_price)} for ${text(after.item_name) || "a line"} instead of ${money(before.list_price)}`;
    case "item_price_changed":
      return `Changed ${text(before.item_name) || "a line"} from ${money(before.line_total)} to ${money(after.line_total)}`;
    case "item_service_changed":
      return `Changed the service from ${text(before.item_name)} to ${text(after.item_name)}`;
    case "staff_reassigned":
      return `Moved ${text(before.item_name) || "a line"} from ${text(before.staff_name) || "no one"} to ${text(after.staff_name) || "no one"}`;
    case "void_requested":
      return "Asked the owner to void the sale";
    case "void_request_cancelled":
      return "Withdrew the void request";
    case "void_request_approved":
      return "Approved the void request";
    case "void_request_rejected":
      return "Rejected the void request";
    default:
      return entry.action.replaceAll("_", " ");
  }
}
