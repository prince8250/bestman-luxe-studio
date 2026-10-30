// The Postgres functions raise short codes (for example 'discount_limit') with
// a plain-language detail. This turns them into the message the POS user sees,
// and keeps anything unexpected generic (details go to the server log only).

interface DbError {
  message: string;
  details?: string | null;
  code?: string;
}

// Codes whose detail text from the database is already written for the user.
const USE_DETAIL = new Set([
  "invalid_input",
  "not_found",
  "staff_unavailable",
  "service_unavailable",
  "invalid_price",
  "reason_required",
  "discount_limit",
  "override_reason_required",
  "payments_mismatch",
  "backdate_limit",
  "future_time",
  "reassign_window",
  "already_voided",
  "void_already_requested",
  "already_closed",
  "not_closed",
  "float_reason_required",
  "adjustment_required",
  "adjustment_mismatch",
  "appointment_not_open",
  "slot_taken",
  "customer_blocked",
  "too_many_upcoming",
]);

export const GENERIC_DB_MESSAGE = "Could not save. Check the internet connection and try again.";

export function dbErrorMessage(error: DbError, context: string): string {
  if (error.message === "not_authorized" || error.code === "42501") {
    return "This needs the owner. Ask the owner to do it.";
  }
  if (USE_DETAIL.has(error.message) && error.details) return error.details;
  console.error(`${context}: ${error.message}`, error.details ?? "");
  return GENERIC_DB_MESSAGE;
}
