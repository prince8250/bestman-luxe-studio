import "server-only";

import type { DateRange } from "@/lib/reports/range";
import {
  reportAfterClose,
  reportBackdated,
  reportByCategory,
  reportByChannel,
  reportByCounterUser,
  reportByPaymentMethod,
  reportByService,
  reportByStaff,
  reportDayClose,
  reportDayCloseExport,
  reportSummary,
  reportVoidRequests,
  reportVoids,
  type DayReport,
  type ReportAfterClose,
  type ReportBackdated,
  type ReportByCategory,
  type ReportByChannel,
  type ReportByCounterUser,
  type ReportByMethod,
  type ReportByService,
  type ReportByStaff,
  type ReportDayClose,
  type ReportSummary,
  type ReportVoidRequests,
  type ReportVoids,
} from "@/lib/reports/reports";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Everything on a day, week, month, or custom report (spec 16), from the spec
// 14 functions. A single day also loads the day report (the same data the
// end-of-day HTML/CSV and the PC backup use), for its list of sales.
export interface PeriodReport {
  range: DateRange;
  summary: ReportSummary;
  payments: ReportByMethod;
  categories: ReportByCategory;
  services: ReportByService;
  staff: ReportByStaff;
  channels: ReportByChannel;
  accounts: ReportByCounterUser;
  voids: ReportVoids;
  voidRequests: ReportVoidRequests;
  backdated: ReportBackdated;
  afterClose: ReportAfterClose;
  dayCloses: ReportDayClose;
  day: DayReport | null;
}

export async function loadPeriodReport(supabase: Supabase, range: DateRange): Promise<PeriodReport> {
  const singleDay = range.from === range.to;
  const [summary, payments, categories, services, staff, channels, accounts, voids, voidRequests, backdated, afterClose, dayCloses, day] =
    await Promise.all([
      reportSummary(supabase, range),
      reportByPaymentMethod(supabase, range),
      reportByCategory(supabase, range),
      reportByService(supabase, range),
      reportByStaff(supabase, range),
      reportByChannel(supabase, range),
      reportByCounterUser(supabase, range),
      reportVoids(supabase, range),
      reportVoidRequests(supabase, range),
      reportBackdated(supabase, range),
      reportAfterClose(supabase, range),
      reportDayClose(supabase, range),
      singleDay ? reportDayCloseExport(supabase, range.from) : Promise.resolve(null),
    ]);
  return { range, summary, payments, categories, services, staff, channels, accounts, voids, voidRequests, backdated, afterClose, dayCloses, day };
}
