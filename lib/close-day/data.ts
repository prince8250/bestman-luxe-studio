import "server-only";

import { z } from "zod";

import type { DayReportFiles } from "@/lib/close-day/close-day";
import { dayReportHtml } from "@/lib/reports/day-report-html";
import { dayReportCsv } from "@/lib/reports/report-csv";
import { ReportError, reportDayCloseExport, type DayReport } from "@/lib/reports/reports";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

// What the Close day screen and the sidebar card read (spec 17). Nothing
// here returns the expected cash for a day that is not closed: the count is
// blind until it is saved.

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const unclosedSchema = z.array(z.object({ business_date: z.string(), sales_count: z.number().int() }));
export type UnclosedDay = z.infer<typeof unclosedSchema>[number];

// Earlier days (up to 14 back) with sales and no close, newest first.
export async function loadUnclosedDays(supabase: Supabase): Promise<UnclosedDay[]> {
  const { data, error } = await supabase.rpc("unclosed_days");
  if (error) throw new Error(`unclosed_days failed: ${error.message}`);
  return unclosedSchema.parse(data);
}

const statusSchema = z.object({
  business_date: z.string(),
  open_since: z.string().nullable(),
  closed_at: z.string().nullable(),
  closed_by: z.string().nullable(),
});
export type DayStatus = z.infer<typeof statusSchema>;

// Today: open since the first sign-in or sale, or closed at what time.
export async function loadDayStatus(supabase: Supabase): Promise<DayStatus> {
  const { data, error } = await supabase.rpc("day_status");
  if (error) throw new Error(`day_status failed: ${error.message}`);
  return statusSchema.parse(data);
}

// The day report of a day with an active close, or null while it is open.
// A counter user's request for an open day is refused by the database
// ("not_closed"); the owner's is checked here, so both get the same answer.
export async function loadClosedDay(supabase: Supabase, date: string): Promise<DayReport | null> {
  try {
    const day = await reportDayCloseExport(supabase, date);
    return day.day_closes.some((close) => close.active) ? day : null;
  } catch (error) {
    if (error instanceof ReportError && error.code === "not_closed") return null;
    throw error;
  }
}

// The two files saved on the PC after the close (spec 16 functions).
export function dayReportFiles(day: DayReport): DayReportFiles {
  return { date: day.business_date, csv: dayReportCsv(day), html: dayReportHtml(day, "a4") };
}
