import { z } from "zod";

// The body of POST /api/backup/heartbeat (spec 20): what one backup run
// reports, saved as a backup_runs row. The token decides which kind of run
// may be reported: the studio PC's token only daily_pc, the GitHub token only
// weekly_cloud, so a leaked PC token can never fake a cloud backup (or back).

export const heartbeatSchema = z
  .object({
    kind: z.enum(["daily_pc", "weekly_cloud"]),
    status: z.enum(["success", "failed"]),
    started_at: z.iso.datetime({ offset: true }).optional(),
    finished_at: z.iso.datetime({ offset: true }).optional(),
    file_name: z.string().trim().min(1).max(200).optional(),
    storage_path: z.string().trim().min(1).max(300).optional(),
    size_bytes: z.number().int().nonnegative().max(10_000_000_000).optional(),
    row_counts: z.record(z.string().max(60), z.number().int().nonnegative()).optional(),
    message: z.string().max(2000).optional(),
  })
  .strict();

export type Heartbeat = z.infer<typeof heartbeatSchema>;

export type TokenKind = "daily_pc" | "weekly_cloud";
