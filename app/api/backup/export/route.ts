import { attachmentHeaders } from "@/lib/backup/day-report";
import { adminSnapshotStream, gzip } from "@/lib/backup/export";
import { snapshotFileName } from "@/lib/backup/schema";
import { getServerEnv } from "@/lib/env.server";
import { bearerMatches, unauthorized } from "@/lib/http/bearer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { accraDate } from "@/lib/time";

// GET /api/backup/export (spec 20): the full JSON snapshot for the studio PC,
// gzip-compressed (bestman-backup-YYYY-MM-DD.json.gz), streamed table by
// table. Only BACKUP_EXPORT_TOKEN is accepted: not the GitHub token, not a
// POS session.

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!bearerMatches(request, getServerEnv().BACKUP_EXPORT_TOKEN)) return unauthorized();
  const stream = gzip(adminSnapshotStream(createSupabaseAdminClient()));
  return new Response(stream, { headers: attachmentHeaders(`${snapshotFileName(accraDate())}.gz`, "application/gzip") });
}
