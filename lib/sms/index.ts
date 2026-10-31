import "server-only";

import { getServerEnv } from "@/lib/env.server";
import { normalizePhone } from "@/lib/phone";
import { sendWithArkesel } from "@/lib/sms/arkesel";
import { sendToConsole } from "@/lib/sms/console";
import { smsLength } from "@/lib/sms/length";
import { MAX_SMS_SEGMENTS, smsFailure, type SmsMessage, type SmsResult } from "@/lib/sms/types";

export type { SmsErrorCode, SmsMessage, SmsMode, SmsResult } from "@/lib/sms/types";

// The one way the app sends an SMS (architecture invariant 15). Features call
// sendSms and record the result; which provider sends it, and whether it is
// sent at all (SMS_MODE console / sandbox / live), is decided only here.
// Like a Spring service behind an interface: callers never see Arkesel.
//
// It never throws: every outcome, including a network failure, comes back as
// an SmsResult, so a failed SMS can never break a sale or a booking.
export async function sendSms({ to, message }: SmsMessage): Promise<SmsResult> {
  const recipient = normalizePhone(to);
  if (!recipient) return smsFailure("invalid_phone", "The phone number is not valid.");
  const text = message.trim();
  if (!text) return smsFailure("empty_message", "The message is empty.");
  const length = smsLength(text);
  if (length.segments > MAX_SMS_SEGMENTS) {
    return smsFailure("too_long", `The message is ${length.segments} SMS long; the limit is ${MAX_SMS_SEGMENTS}.`);
  }

  const env = getServerEnv();
  if (env.SMS_MODE === "console") return sendToConsole(recipient, text, length);
  // The env check at start-up guarantees both are set outside console mode.
  if (!env.SMS_API_KEY || !env.SMS_SENDER_ID) return smsFailure("not_configured", "SMS_API_KEY and SMS_SENDER_ID are not set.");
  return sendWithArkesel({
    to: recipient,
    message: text,
    apiKey: env.SMS_API_KEY,
    sender: env.SMS_SENDER_ID,
    sandbox: env.SMS_MODE === "sandbox",
    segments: length.segments,
  });
}
