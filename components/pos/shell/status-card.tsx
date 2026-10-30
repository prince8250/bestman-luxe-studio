import Link from "next/link";
import { DatabaseBackup, Lock } from "lucide-react";

import type { PosUser } from "@/lib/auth/types";
import { isBackupStale, type BackupKind } from "@/lib/backups/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, accraDayStart, formatAccraDayTime, formatAccraTime } from "@/lib/time";
import { cn } from "@/lib/utils";

// The card at the bottom of the sidebar: backup health for the owner, the
// day's status for the counter (ui-context.md, "Mapping The Reference").
export async function StatusCard({ user }: { user: PosUser }) {
  return user.role === "owner" ? <BackupStatusCard /> : <DayStatusCard user={user} />;
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

async function DayStatusCard({ user }: { user: PosUser }) {
  const supabase = await createSupabaseServerClient();
  const today = accraDate();
  const [{ data: close }, { data: firstSignIn }] = await Promise.all([
    supabase
      .from("day_closes")
      .select("closed_at")
      .eq("business_date", today)
      .is("reopened_at", null)
      .maybeSingle(),
    supabase
      .from("sign_in_events")
      .select("signed_in_at")
      .eq("profile_id", user.id)
      .gte("signed_in_at", accraDayStart(today).toISOString())
      .order("signed_in_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="rounded-[16px] border border-pos-border bg-pos-bg p-4">
      <p className="text-sm font-medium">{close ? "Day closed" : "Day open"}</p>
      <p className="mt-0.5 text-xs text-pos-text-muted">
        {close
          ? `Closed at ${formatAccraTime(close.closed_at)}`
          : firstSignIn
            ? `Open since ${formatAccraTime(firstSignIn.signed_in_at)}`
            : "Not signed in today yet"}
      </p>
      {!close && (
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
