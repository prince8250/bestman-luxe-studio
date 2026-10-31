import { formatGhs } from "@/lib/money";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { plainSmsText, smsLength } from "@/lib/sms/length";
import { formatAccraDayTime } from "@/lib/time";

// SMS texts (spec 18). Each is kept to one SMS (160 GSM-7 characters) when it
// can be: long names are shortened first, and typographic characters are
// swapped for plain ones so the text never turns into the 70-character kind.

export interface BookingConfirmationDetails {
  studioName: string;
  service: string;
  /** The appointment start (ISO string or Date), shown in Accra time. */
  startsAt: string | Date;
  /** The short booking code, for example "BK-7K4Q". */
  code: string;
  /** The studio phone in any format (shown as 024 456 5866). */
  studioPhone: string;
}

function shorten(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(max - 3, 1)).trimEnd()}...`;
}

// "Bestman Luxe Studio: you're booked for Haircuts on Sat 31 Oct, 14:30.
//  Code BK-7K4Q. To change or cancel, call 024 456 5866."
export function bookingConfirmationSms(details: BookingConfirmationDetails): string {
  const phone = normalizePhone(details.studioPhone);
  const when = formatAccraDayTime(details.startsAt);
  const build = (studio: string, service: string) =>
    plainSmsText(
      `${studio}: you're booked for ${service} on ${when}. Code ${details.code}. ` +
        `To change or cancel, call ${phone ? formatPhone(phone) : details.studioPhone}.`,
    );

  let studio = plainSmsText(details.studioName);
  let service = plainSmsText(details.service);
  let text = build(studio, service);
  // Too long for one SMS: shorten the service, then the studio name.
  while (smsLength(text).segments > 1 && (service.length > 20 || studio.length > 20)) {
    if (service.length > 20) service = shorten(service, service.length - 5);
    else studio = shorten(studio, studio.length - 5);
    text = build(studio, service);
  }
  return text;
}

// --- Owner alerts (spec 19) --------------------------------------------------

export type OwnerAlertKind =
  | "void_requested"
  | "cash_difference"
  | "backdated_sale"
  | "large_override"
  | "after_close_sale"
  | "day_summary"
  | "day_not_closed"
  | "backup_stale";

export interface OwnerAlert {
  kind: OwnerAlertKind;
  /** What the database stored when the alert was queued. */
  payload: Record<string, unknown>;
  /** The sale, for sale alerts. */
  sale?: { receipt_no: string; total: number } | null;
}

const shortDate = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

const text = (value: unknown, max = 60) => (typeof value === "string" ? shorten(value.trim(), max) : "");
const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0) || 0);
const money = (value: unknown) => formatGhs(num(value));
const day = (value: unknown) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? shortDate.format(new Date(`${value}T00:00:00Z`)) : "today";
const signed = (pesewas: number) => (pesewas > 0 ? `+${formatGhs(pesewas)}` : formatGhs(pesewas));

// One short SMS per alert for the owner's phone: who, what, the receipt
// number and the amounts. Never a customer's phone number.
export function ownerAlertSms({ kind, payload, sale }: OwnerAlert): string {
  const receipt = text(payload.receipt_no, 20) || sale?.receipt_no || "a sale";
  const total = money(payload.total ?? sale?.total);
  const by = text(payload.by ?? payload.closed_by, 30) || "Someone";

  switch (kind) {
    case "void_requested":
      return plainSmsText(`POS: ${by} asks to void ${receipt} (${total}): "${text(payload.reason)}". Approve or reject in Activity.`);
    case "cash_difference": {
      const difference = num(payload.cash_difference);
      return plainSmsText(
        `POS: cash ${difference < 0 ? "short" : "over"} by ${formatGhs(Math.abs(difference))} on ${day(payload.business_date)}. ` +
          `Counted ${money(payload.counted_cash)}, expected ${money(payload.expected_cash)}. Closed by ${by}.`,
      );
    }
    case "backdated_sale": {
      const when = typeof payload.paid_at === "string" ? formatAccraDayTime(payload.paid_at) : "an earlier day";
      return plainSmsText(`POS: ${by} entered a past sale ${receipt} (${total}) dated ${when}.`);
    }
    case "large_override": {
      const lines = Array.isArray(payload.lines) ? (payload.lines as Record<string, unknown>[]) : [];
      const first = lines[0];
      const change = first
        ? `${text(first.item_name, 30)} ${money(first.list_price)} -> ${money(first.unit_price)}${num(first.quantity) > 1 ? ` x${num(first.quantity)}` : ""}` +
          (text(first.reason) ? ` (${text(first.reason, 40)})` : "")
        : "a price";
      const more = lines.length > 1 ? `, and ${lines.length - 1} more` : "";
      return plainSmsText(`POS: big price change on ${receipt} by ${by}: ${change}${more}.`);
    }
    case "after_close_sale":
      return plainSmsText(`POS: sale after the day was closed: ${receipt} (${total}) by ${by} on ${day(payload.business_date)}.`);
    case "day_summary":
      return plainSmsText(
        `POS: ${day(payload.business_date)} closed by ${by}. Revenue ${money(payload.revenue)}, ${num(payload.services_count)} services. ` +
          `Cash ${money(payload.cash)}, MoMo ${money(payload.momo)}, card ${money(payload.card)}. ` +
          `Cash difference ${signed(num(payload.cash_difference))}. Voids ${num(payload.voids_count)}, void requests waiting ${num(payload.pending_void_requests)}.`,
      );
    case "day_not_closed":
      return plainSmsText(
        `POS: ${day(payload.business_date)} was not closed. ${num(payload.sales_count)} sales, revenue ${money(payload.revenue)} ` +
          `(cash ${money(payload.cash)}, MoMo ${money(payload.momo)}, card ${money(payload.card)}). Please close the day.`,
      );
    case "backup_stale": {
      const last = typeof payload.last_backup_at === "string" ? `; the last one was ${formatAccraDayTime(payload.last_backup_at)}` : "";
      return plainSmsText(`POS: no PC backup for ${day(payload.business_date)}${last}. Check the backup on the studio PC.`);
    }
  }
}
