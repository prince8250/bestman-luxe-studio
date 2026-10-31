import { createHash, timingSafeEqual } from "node:crypto";

import { sendPendingOwnerAlerts } from "@/lib/alerts/send";
import { getServerEnv } from "@/lib/env.server";
import { isCalendarDate } from "@/lib/reports/range";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { accraDate, addDays } from "@/lib/time";

// The owner's nightly job (spec 19), called by Vercel Cron at 23:30 Accra
// (vercel.json: "30 23 * * *"; Vercel schedules are in UTC, which is Accra's
// time all year). Vercel sends "Authorization: Bearer <CRON_SECRET>".
//
// For today, and yesterday in case a run was missed (Vercel delivery is best
// effort and never retried): a day with sales but no close queues
// day_not_closed, a day with sales but no PC backup queues backup_stale. The
// alerts are keyed by date, so a duplicate or repeated run adds nothing. Then
// every pending alert is sent.
//
// For a test: GET /api/cron/owner-daily?date=YYYY-MM-DD checks that day only.

export const maxDuration = 60;

// Compares hashes of the two values, so the check takes the same time
// whatever the header holds (no hints for guessing the secret).
function authorized(request: Request): boolean {
  const secret = getServerEnv().CRON_SECRET;
  if (!secret) return false;
  const given = createHash("sha256").update(request.headers.get("authorization") ?? "").digest();
  const expected = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const today = accraDate();
  const requested = new URL(request.url).searchParams.get("date");
  if (requested !== null && (!isCalendarDate(requested) || requested > today)) {
    return Response.json({ error: "date must be YYYY-MM-DD, today or earlier" }, { status: 400 });
  }
  const dates = requested ? [requested] : [addDays(today, -1), today];

  const admin = createSupabaseAdminClient();
  const checks: unknown[] = [];
  for (const date of dates) {
    const { data, error } = await admin.rpc("owner_daily_check", { p_date: date });
    if (error) {
      console.error(`owner daily check for ${date} failed`, error.message);
      return Response.json({ error: "The daily check failed." }, { status: 500 });
    }
    checks.push(data);
  }
  const sms = await sendPendingOwnerAlerts();
  return Response.json({ checks, sms });
}
