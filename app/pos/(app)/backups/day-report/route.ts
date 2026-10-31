import { attachmentHeaders, dayReportFile, isDayReportFormat } from "@/lib/backup/day-report";
import { PermissionError, requirePermission } from "@/lib/auth/require-pos-user";
import { isCalendarDate } from "@/lib/reports/range";
import { reportDayCloseExport } from "@/lib/reports/reports";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate } from "@/lib/time";

// GET /pos/backups/day-report?date=YYYY-MM-DD&format=csv|html (spec 20):
// "Download day report" for the owner, the same file the studio PC saves,
// read through the owner's own session. Recorded as a manual_download run.

export async function GET(request: Request) {
  let user;
  try {
    user = await requirePermission("backups.view");
  } catch (error) {
    if (error instanceof PermissionError) return new Response("This is for the owner.", { status: 403 });
    throw error;
  }

  const params = new URL(request.url).searchParams;
  const date = params.get("date") ?? "";
  const format = params.get("format");
  if (!isCalendarDate(date) || date > accraDate() || !isDayReportFormat(format)) {
    return new Response("Choose a day (today or earlier) and CSV or HTML.", { status: 400 });
  }

  try {
    const file = dayReportFile(await reportDayCloseExport(await createSupabaseServerClient(), date), format);
    await createSupabaseAdminClient().from("backup_runs").insert({
      kind: "manual_download",
      status: "success",
      finished_at: new Date().toISOString(),
      file_name: file.fileName,
      size_bytes: Buffer.byteLength(file.body),
      message: `Downloaded in the POS by ${user.displayName}`,
    });
    return new Response(file.body, { headers: attachmentHeaders(file.fileName, file.contentType) });
  } catch (error) {
    console.error(`manual day report download for ${date} failed`, error instanceof Error ? error.message : error);
    return new Response("The day report could not be made. Check the internet connection and try again.", { status: 500 });
  }
}
