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
