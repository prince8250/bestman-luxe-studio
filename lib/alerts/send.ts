import "server-only";

import { after } from "next/server";
import { z } from "zod";

import { getServerEnv } from "@/lib/env.server";
import { sendSms } from "@/lib/sms";
import { ownerAlertSms } from "@/lib/sms/templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Sends the owner's pending SMS alerts (spec 19). The alerts are queued in
// the database by the functions that cause them (a void request, a past sale,
// a close...), one row per occurrence. claim_owner_alerts decides each one
// under a lock (switched off, no owner phone, over the daily cap, too old) and
// hands back only those to send now, so two senders never send the same one.
//
// Like a Spring @Async listener: the action finishes first, the SMS goes after,
// and a failed SMS is recorded on the alert, never thrown back at the action.

const claimedSchema = z.array(
  z.object({
    id: z.string(),
    kind: z.enum([
      "void_requested",
      "cash_difference",
      "backdated_sale",
      "large_override",
      "after_close_sale",
      "day_summary",
      "day_not_closed",
      "backup_stale",
    ]),
    payload: z.record(z.string(), z.unknown()),
    phone: z.string(),
    sale: z.object({ receipt_no: z.string(), total: z.number() }).nullable().optional(),
  }),
);

// Notes for alerts handled without a real SMS, so the list never claims one went out.
const MODE_NOTE = { console: "Console: logged, not delivered", sandbox: "Sandbox: accepted by Arkesel, not delivered", live: null } as const;

export async function sendPendingOwnerAlerts(): Promise<{ sent: number; failed: number }> {
  const outcome = { sent: 0, failed: 0 };
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.rpc("claim_owner_alerts", { p_limit: 20 });
    if (error) {
      console.error("owner alerts: claim failed", error.message);
      return outcome;
    }
    const mode = getServerEnv().SMS_MODE;
    for (const alert of claimedSchema.parse(data)) {
      let ok = false;
      let note: string | null;
      try {
        const result = await sendSms({ to: alert.phone, message: ownerAlertSms(alert) });
        ok = result.ok;
        note = result.ok ? MODE_NOTE[mode] : `${result.error}: ${result.message}`;
      } catch (failure) {
        note = failure instanceof Error ? failure.message : "Unexpected error";
      }
      const { error: finishError } = await admin.rpc("finish_owner_alert", { p_id: alert.id, p_ok: ok, p_error: note ?? undefined });
      if (finishError) console.error("owner alerts: could not record the result", finishError.message);
      if (ok) outcome.sent += 1;
      else outcome.failed += 1;
    }
  } catch (failure) {
    console.error("owner alerts: sending failed", failure);
  }
  return outcome;
}

// For server actions that may have queued an alert: send after the response,
// so the counter never waits for an SMS.
export function sendOwnerAlertsLater() {
  after(() => sendPendingOwnerAlerts());
}
