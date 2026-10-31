import { gzipSync } from "node:zlib";

import { attachmentHeaders } from "@/lib/backup/day-report";
import { adminSnapshotStream } from "@/lib/backup/export";
import { snapshotFileName } from "@/lib/backup/schema";
import { PermissionError, requirePermission } from "@/lib/auth/require-pos-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { accraDate } from "@/lib/time";

// GET /pos/backups/snapshot (spec 20): "Download backup now" for the owner,
// the same JSON snapshot the studio PC saves. The browser receives it
// compressed and saves it as bestman-backup-YYYY-MM-DD.json. Every download
// is recorded as a manual_download run.

export const maxDuration = 300;

export async function GET() {
  let user;
  try {
    user = await requirePermission("backups.view");
  } catch (error) {
    if (error instanceof PermissionError) return new Response("This is for the owner.", { status: 403 });
    throw error;
  }

  const admin = createSupabaseAdminClient();
  const fileName = snapshotFileName(accraDate());
  let counts: Record<string, number> = {};
  try {
    const json = await new Response(adminSnapshotStream(admin, (done) => (counts = done))).text();
    await admin.from("backup_runs").insert({
      kind: "manual_download",
      status: "success",
      finished_at: new Date().toISOString(),
      file_name: fileName,
      size_bytes: Buffer.byteLength(json),
      row_counts: counts,
      message: `Downloaded in the POS by ${user.displayName}`,
    });
    return new Response(gzipSync(json), {
      headers: { ...attachmentHeaders(fileName, "application/json; charset=utf-8"), "Content-Encoding": "gzip" },
    });
  } catch (error) {
    console.error("manual backup download failed", error instanceof Error ? error.message : error);
    await admin.from("backup_runs").insert({
      kind: "manual_download",
      status: "failed",
      finished_at: new Date().toISOString(),
      file_name: fileName,
      message: `Download in the POS by ${user.displayName} failed`,
    });
    return new Response("The backup could not be made. Check the internet connection and try again.", { status: 500 });
  }
}
