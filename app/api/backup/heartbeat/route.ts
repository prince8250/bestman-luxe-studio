import { heartbeatSchema, type TokenKind } from "@/lib/backup/heartbeat";
import { getServerEnv } from "@/lib/env.server";
import { bearerMatches, unauthorized } from "@/lib/http/bearer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// POST /api/backup/heartbeat (spec 20): a backup run reports how it went and
// a backup_runs row is written (the sidebar card, the Backups page, and the
// 23:30 "no PC backup" check read them). BACKUP_EXPORT_TOKEN (the studio PC)
// may report daily_pc runs only; BACKUP_WEBHOOK_TOKEN (GitHub Actions)
// weekly_cloud runs only.

function tokenKind(request: Request): TokenKind | null {
  const env = getServerEnv();
  if (bearerMatches(request, env.BACKUP_EXPORT_TOKEN)) return "daily_pc";
  if (bearerMatches(request, env.BACKUP_WEBHOOK_TOKEN)) return "weekly_cloud";
  return null;
}

export async function POST(request: Request) {
  const allowed = tokenKind(request);
  if (!allowed) return unauthorized();

  const parsed = heartbeatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "The body is not a valid heartbeat." }, { status: 400 });
  }
  const run = parsed.data;
  if (run.kind !== allowed) {
    return Response.json({ error: `This token can only report ${allowed} runs.` }, { status: 403 });
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("backup_runs")
    .insert({
      kind: run.kind,
      status: run.status,
      started_at: run.started_at,
      finished_at: run.finished_at ?? new Date().toISOString(),
      file_name: run.file_name,
      storage_path: run.storage_path,
      size_bytes: run.size_bytes,
      row_counts: run.row_counts,
      message: run.message,
    })
    .select("id")
    .single();
  if (error) {
    console.error("backup heartbeat could not be saved", error.message);
    return Response.json({ error: "The run could not be saved." }, { status: 500 });
  }
  return Response.json({ id: data.id }, { status: 201 });
}
