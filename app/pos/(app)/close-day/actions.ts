"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { dbErrorMessage, GENERIC_DB_MESSAGE } from "@/lib/actions/db-errors";
import { fail, ok, runPosAction, type ActionResult } from "@/lib/actions/result";
import { closeDaySchema, type CloseDayInput, type DayReportFiles } from "@/lib/close-day/close-day";
import { dayReportFiles, loadClosedDay } from "@/lib/close-day/data";
import type { Database } from "@/lib/database.types";
import { isCalendarDate } from "@/lib/reports/range";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate } from "@/lib/time";

// Close day (spec 17). The counted cash goes to close_day, which works out
// the expected cash on the server, stores the close, and queues the owner's
// alerts. Only then does anything about the expected cash reach the browser.

function refresh() {
  // The Close day page, the sidebar day card, New sale's after-close banner.
  revalidatePath("/pos", "layout");
}

export async function closeDayAction(input: CloseDayInput): Promise<ActionResult<{ files: DayReportFiles | null }>> {
  return runPosAction("day.close", async () => {
    const supabase = await createSupabaseServerClient();
    const { data: settings, error: settingsError } = await supabase
      .from("studio_settings")
      .select("default_opening_float")
      .eq("id", true)
      .single();
    if (settingsError) return fail(GENERIC_DB_MESSAGE);

    const parsed = closeDaySchema(settings.default_opening_float).safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
    const values = parsed.data;
    if (values.date > accraDate()) return fail("Choose today or an earlier day.");

    // The generated types mark every argument as required and non-null;
    // close_day takes null for "no MoMo total" and "no note".
    const args = {
      p_business_date: values.date,
      p_counted_cash: values.countedCash,
      p_momo_reported: values.momoReported,
      p_opening_float: values.openingFloat,
      p_note: values.note,
      p_opening_float_reason: values.openingFloatReason,
    } as unknown as Database["public"]["Functions"]["close_day"]["Args"];
    const { error } = await supabase.rpc("close_day", args);
    if (error) return fail(dbErrorMessage(error, "close_day failed"));
    refresh();

    // The files for the automatic download. The close is already saved, so a
    // failure here only means the page offers the download again.
    let files: DayReportFiles | null = null;
    try {
      const day = await loadClosedDay(supabase, values.date);
      files = day ? dayReportFiles(day) : null;
    } catch (error) {
      console.error("day report after close failed", error);
    }
    return ok({ files });
  });
}

// The day report as CSV and HTML, only for a day with an active close. The
// one report a counter user can get.
export async function dayReportFilesAction(date: string): Promise<ActionResult<DayReportFiles>> {
  return runPosAction("day.closeReport", async () => {
    if (!isCalendarDate(date)) return fail("Choose a day.");
    const supabase = await createSupabaseServerClient();
    const day = await loadClosedDay(supabase, date);
    if (!day) return fail("The day report is ready after the day is closed.");
    return ok(dayReportFiles(day));
  });
}

const reason = z.string().trim().min(1, "Give a reason for reopening the day.").max(300, "Keep the reason under 300 characters.");

// Owner only: reopen a closed day (the close stays in the history).
export async function reopenDayAction(date: string, rawReason: string): Promise<ActionResult> {
  return runPosAction("day.reopen", async () => {
    if (!isCalendarDate(date)) return fail("Choose a day.");
    const parsed = reason.safeParse(rawReason);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Give a reason.");
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc("reopen_day", { p_business_date: date, p_reason: parsed.data });
    if (error) return fail(dbErrorMessage(error, "reopen_day failed"));
    refresh();
    return ok(undefined);
  });
}
