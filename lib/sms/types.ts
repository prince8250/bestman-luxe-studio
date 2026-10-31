// The one result shape every SMS send returns (spec 18), so callers (owner
// alerts, spec 19; booking confirmations, spec 35) can record what happened
// without knowing the provider.

export type SmsMode = "console" | "sandbox" | "live";

export type SmsErrorCode =
  /** The number is not a valid phone number. */
  | "invalid_phone"
  | "empty_message"
  /** Longer than the cost limit (MAX_SMS_SEGMENTS). */
  | "too_long"
  /** The API key or the sender ID was refused. */
  | "not_configured"
  /** The provider account has no SMS credit left. */
  | "no_balance"
  /** The provider refused this message or number. */
  | "rejected"
  /** The provider failed or answered in an unexpected way. */
  | "provider_error"
  /** The provider could not be reached (or did not answer in time). */
  | "network";

export type SmsResult =
  | { ok: true; mode: SmsMode; provider: "console" | "arkesel"; id: string | null; segments: number }
  | { ok: false; error: SmsErrorCode; message: string };

export interface SmsMessage {
  /** Any common phone format; it is turned into E.164 first. */
  to: string;
  message: string;
}

// At most 3 parts (459 GSM-7 characters): enough for any message the POS
// sends, and a cap on cost if a bug builds a huge text.
export const MAX_SMS_SEGMENTS = 3;

export function smsFailure(error: SmsErrorCode, message: string): SmsResult {
  return { ok: false, error, message };
}

// "+233244565866" -> "+233*****866": enough to tell numbers apart in a log
// without writing a customer's number down in full.
export function maskPhone(e164: string): string {
  return e164.length > 7 ? `${e164.slice(0, 4)}${"*".repeat(e164.length - 7)}${e164.slice(-3)}` : "***";
}
