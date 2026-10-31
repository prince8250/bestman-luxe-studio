import type { SmsLength } from "@/lib/sms/length";
import { maskPhone, type SmsResult } from "@/lib/sms/types";

// SMS_MODE=console: nothing is sent; the message is written to the server log
// instead. The text itself is logged only outside production (a message can
// contain a customer's booking details).
export function sendToConsole(to: string, message: string, length: SmsLength, production = process.env.NODE_ENV === "production"): SmsResult {
  const summary = `[sms:console] to ${production ? maskPhone(to) : to}, ${length.segments} SMS (${length.units} ${length.encoding} characters)`;
  console.info(production ? summary : `${summary}\n${message}`);
  return { ok: true, mode: "console", provider: "console", id: null, segments: length.segments };
}
