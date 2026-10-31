import Link from "next/link";
import { DatabaseBackup, Lock } from "lucide-react";

import type { PosUser } from "@/lib/auth/types";
import { isBackupStale, type BackupKind } from "@/lib/backups/status";
import { loadDayStatus } from "@/lib/close-day/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAccraDayTime, formatAccraTime } from "@/lib/time";
import { cn } from "@/lib/utils";

// The card at the bottom of the sidebar: backup health for the owner, the
// day's status for the counter (ui-context.md, "Mapping The Reference").
export async function StatusCard({ user }: { user: PosUser }) {
  return user.role === "owner" ? <BackupStatusCard /> : <DayStatusCard />;
}

// Backup health at a glance; the full Backups page is spec 22.
async function BackupStatusCard() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("backup_runs")
    .select("kind, created_at")
    .eq("status", "success")
    .in("kind", ["daily_pc", "weekly_cloud"])
    .order("created_at", { ascending: false })
    .limit(20);

  const latest = (kind: BackupKind) => data?.find((run) => run.kind === kind)?.created_at ?? null;
  const rows = (
    [
      { label: "PC backup", kind: "daily_pc" },
      { label: "Cloud backup", kind: "weekly_cloud" },
    ] as const
  ).map((row) => {
    const at = latest(row.kind);
    return { ...row, at, stale: isBackupStale(row.kind, at) };
  });

  return (
    <Link
      href="/pos/backups"
      className="block rounded-[16px] border border-pos-border bg-pos-bg p-4 transition-colors duration-150 hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <DatabaseBackup className="h-4 w-4" /> Backups
      </p>
      <dl className="mt-2 space-y-1 text-xs">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="text-pos-text-muted">{row.label}</dt>
            <dd className={cn("text-right", row.stale ? "font-medium text-pos-down" : "text-pos-text")}>
              {row.at ? formatAccraDayTime(row.at) : "Not yet"}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

// "Day open since 08:12" (the first sign-in or sale of the day, by anyone) or
// "Day closed at 20:41" (spec 17, day_status).
async function DayStatusCard() {
  const status = await loadDayStatus(await createSupabaseServerClient());
  const closed = status.closed_at !== null;

  return (
    <div className="rounded-[16px] border border-pos-border bg-pos-bg p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden className={cn("h-2 w-2 rounded-full", closed ? "bg-pos-text-muted" : "bg-pos-up")} />
        {status.closed_at
          ? `Day closed at ${formatAccraTime(status.closed_at)}`
          : status.open_since
            ? `Day open since ${formatAccraTime(status.open_since)}`
            : "Day open"}
      </p>
      {status.closed_at && status.closed_by && <p className="mt-0.5 text-xs text-pos-text-muted">By {status.closed_by}</p>}
      {!closed && (
        <Link
          href="/pos/close-day"
          className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-pos-border bg-pos-surface text-sm font-medium hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <Lock className="h-4 w-4" /> Close day
        </Link>
      )}
    </div>
  );
}
