import "server-only";

import { dayReportHtml } from "@/lib/reports/day-report-html";
import { dayReportCsv } from "@/lib/reports/report-csv";
import { reportSchemas, type DayReport } from "@/lib/reports/reports";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

// The end-of-day report files of the backup (spec 20), from the same spec 16
// functions as the POS: day-report-YYYY-MM-DD.csv for Excel and .html to read
// or print with no internet.

type Admin = ReturnType<typeof createSupabaseAdminClient>;

export type DayReportFormat = "csv" | "html";

export function isDayReportFormat(value: string | null): value is DayReportFormat {
  return value === "csv" || value === "html";
}

// For the PC script (service role): any day, closed or not.
export async function loadBackupDayReport(admin: Admin, date: string): Promise<DayReport> {
  const { data, error } = await admin.rpc("backup_day_report", { p_business_date: date });
  if (error) throw new Error(`backup_day_report failed: ${error.message}`);
  return reportSchemas.dayReport.parse(data);
}

export function dayReportFile(day: DayReport, format: DayReportFormat) {
  const fileName = `day-report-${day.business_date}.${format}`;
  return format === "csv"
    ? { fileName, contentType: "text/csv; charset=utf-8", body: dayReportCsv(day) }
    : { fileName, contentType: "text/html; charset=utf-8", body: dayReportHtml(day, "a4") };
}

export function attachmentHeaders(fileName: string, contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "no-store",
  };
}
