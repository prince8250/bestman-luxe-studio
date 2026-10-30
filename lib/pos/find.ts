// What a POS user typed into Find: a receipt number, a booking code, or a
// phone number. Wired to real lookups in specs 10 (receipts), 13 (phones),
// and 36 (booking codes).

export type FindQuery =
  | { kind: "receipt"; value: string }
  | { kind: "booking"; value: string }
  | { kind: "phone"; value: string }
  | { kind: "unknown"; value: string };

const BOOKING_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function classifyFindQuery(raw: string): FindQuery {
  const text = raw.trim();
  const compact = text.replace(/[\s-]/g, "").toUpperCase();

  const receipt = /^BLS(\d{1,9})$/.exec(compact);
  if (receipt) return { kind: "receipt", value: `BLS-${receipt[1].padStart(6, "0")}` };

  const booking = new RegExp(`^BK([${BOOKING_ALPHABET}]{4,6})$`).exec(compact);
  if (booking) return { kind: "booking", value: `BK-${booking[1]}` };

  const digits = text.replace(/[\s()-]/g, "");
  if (/^\+?\d{9,15}$/.test(digits)) return { kind: "phone", value: digits };

  return { kind: "unknown", value: text };
}
