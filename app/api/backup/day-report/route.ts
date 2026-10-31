import { attachmentHeaders, dayReportFile, isDayReportFormat, loadBackupDayReport } from "@/lib/backup/day-report";
import { getServerEnv } from "@/lib/env.server";
import { bearerMatches, unauthorized } from "@/lib/http/bearer";
import { isCalendarDate } from "@/lib/reports/range";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { accraDate } from "@/lib/time";

// GET /api/backup/day-report?date=YYYY-MM-DD&format=csv|html (spec 20): one
// day's end-of-day report for the studio PC, the same file as the POS gives.
// Only BACKUP_EXPORT_TOKEN is accepted.

export async function GET(request: Request) {
  if (!bearerMatches(request, getServerEnv().BACKUP_EXPORT_TOKEN)) return unauthorized();

  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const format = params.get("format");
  if (!isCalendarDate(date) || date > accraDate() || !isDayReportFormat(format)) {
    return Response.json({ error: "Use ?date=YYYY-MM-DD (today or earlier)&format=csv or html." }, { status: 400 });
  }
  try {
    const file = dayReportFile(await loadBackupDayReport(createSupabaseAdminClient(), date), format);
    return new Response(file.body, { headers: attachmentHeaders(file.fileName, file.contentType) });
  } catch (error) {
    console.error(`backup day report for ${date} failed`, error instanceof Error ? error.message : error);
    return Response.json({ error: "The day report could not be made." }, { status: 500 });
  }
}
