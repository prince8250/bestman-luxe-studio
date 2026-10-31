import type { Metadata } from "next";
import { CalendarDays, Cloud, DatabaseBackup, Download, Monitor } from "lucide-react";

import { PageHeader } from "@/components/brand-pos/page-header";
import { posButtonVariants } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { OwnerOnly } from "@/components/pos/owner-only";
import { ReportTable } from "@/components/pos/reports/report-parts";
import { Badge } from "@/components/pos/sales/sale-badges";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { isBackupStale, type BackupKind } from "@/lib/backups/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, formatAccraDayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Backups" };

const KIND: Record<string, string> = { daily_pc: "Studio PC", weekly_cloud: "Weekly cloud", manual_download: "Downloaded in the POS" };

function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function timeAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  return `${Math.round(hours / 24)} days ago`;
}

// The total of a run's row counts (every record in the backup).
function totalRows(counts: unknown): number | null {
  if (!counts || typeof counts !== "object") return null;
  const values = Object.entries(counts as Record<string, unknown>)
    .filter(([key]) => key !== "pos_accounts")
    .map(([, value]) => Number(value));
  return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) : null;
}

const control =
  "h-11 rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base text-pos-text md:text-sm focus-visible:outline-2 focus-visible:outline-pos-accent";

const STATUS_TEXT: Record<BackupKind, { label: string; none: string; fresh: string; stale: string }> = {
  daily_pc: {
    label: "Studio PC backup",
    none: "Not set up yet: install it on the studio PC (tools/pc-backup/README.md). Until then, use Download backup now.",
    fresh: "The studio PC saves a full backup and the day report at log-on and every 2 hours while it is on.",
    stale:
      "More than 36 hours ago. That is normal when the studio was closed and the PC was off (a Sunday or a holiday). Otherwise, check the studio PC: its log is backup-log.txt in the backup folder.",
  },
  weekly_cloud: {
    label: "Weekly cloud backup",
    none: "None yet. It runs every Sunday night once the GitHub workflow is set up (docs/restore-guide.md).",
    fresh: "A full copy of the database every Sunday night, kept for 12 weeks in the cloud.",
    stale: "More than 8 days ago: the Sunday backup did not run. Check the workflow's last run on GitHub (Actions > Weekly cloud backup).",
  },
};

function StatusCard({ kind, lastAt }: { kind: BackupKind; lastAt: string | null }) {
  const stale = isBackupStale(kind, lastAt);
  const text = STATUS_TEXT[kind];
  const Icon = kind === "daily_pc" ? Monitor : Cloud;
  return (
    <section
      aria-label={text.label}
      className={cn("rounded-[16px] border p-4 md:p-5", stale ? "border-pos-warning/40 bg-pos-warning-soft" : "border-pos-border bg-pos-surface")}
    >
      <p className={cn("flex items-center gap-2 font-medium", stale && "text-pos-warning")}>
        <Icon aria-hidden className="h-5 w-5 shrink-0" />
        {lastAt ? `${text.label}: ${formatAccraDayTime(lastAt)} (${timeAgo(lastAt)})` : `${text.label}: none yet`}
      </p>
      <p className="mt-1 text-sm text-pos-text-muted">{!lastAt ? text.none : stale ? text.stale : text.fresh}</p>
    </section>
  );
}

// Backups (owner only): the three copies of the records at a glance
// (backup-and-recovery.md), every recent run, the weekly cloud dumps to
// download, and "Download backup now" / "Download day report" (spec 20).
export default async function BackupsPage() {
  const { allowed } = await pageAccess("backups.view");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const lastSuccess = (kind: BackupKind) =>
    supabase
      .from("backup_runs")
      .select("created_at")
      .eq("kind", kind)
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  const [{ data: runs }, { data: lastPc }, { data: lastWeekly }, dumps] = await Promise.all([
    supabase
      .from("backup_runs")
      .select("id, kind, status, created_at, file_name, size_bytes, row_counts, message")
      .order("created_at", { ascending: false })
      .limit(20),
    lastSuccess("daily_pc"),
    lastSuccess("weekly_cloud"),
    // The bucket is private; listing it needs the service role (owner page).
    createSupabaseAdminClient().storage.from("backups").list("weekly", { limit: 20, sortBy: { column: "name", order: "desc" } }),
  ]);
  const today = accraDate();
  const weeklyDumps = (dumps.data ?? []).filter((file) => /^bestman-\d{4}-\d{2}-\d{2}\.dump$/.test(file.name));

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 md:p-8">
      <PageHeader title="Backups" description="Copies of the studio's records, and a way to take one now." />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatusCard kind="daily_pc" lastAt={lastPc?.created_at ?? null} />
        <StatusCard kind="weekly_cloud" lastAt={lastWeekly?.created_at ?? null} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PosCard title="Download backup now">
          <p className="mb-4 text-sm text-pos-text-muted">
            Every record (sales, customers, staff, services, settings, history) in one file, the same as the studio PC saves each day.
            The file holds customer names and phone numbers: keep it somewhere private.
          </p>
          {/* A plain link: the server sends the file and the page stays where it is. */}
          <a href="/pos/backups/snapshot" className={posButtonVariants()}>
            <DatabaseBackup /> Download backup now
          </a>
        </PosCard>

        <PosCard title="Download day report">
          <p className="mb-4 text-sm text-pos-text-muted">One day&apos;s end-of-day report: CSV for Excel, or HTML to read and print.</p>
          <form method="get" action="/pos/backups/day-report" className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="flex items-center gap-1.5 text-pos-text-muted">
                <CalendarDays className="h-4 w-4" /> Day
              </span>
              <input type="date" name="date" defaultValue={today} max={today} required className={control} />
            </label>
            <button type="submit" name="format" value="csv" className={posButtonVariants({ variant: "secondary" })}>
              <Download /> CSV
            </button>
            <button type="submit" name="format" value="html" className={posButtonVariants({ variant: "secondary" })}>
              <Download /> HTML
            </button>
          </form>
        </PosCard>

        <PosCard title="Weekly cloud backups" className="lg:col-span-2">
          <p className="-mt-2 mb-3 text-sm text-pos-text-muted">
            Full database copies for restoring with the developer (docs/restore-guide.md). Each download link works for one minute.
          </p>
          <ReportTable
            columns={[{ label: "File" }, { label: "Size", numeric: true }, { label: "" }]}
            rows={weeklyDumps.map((file) => [
              <span key="n" className="break-all">
                {file.name}
              </span>,
              formatBytes((file.metadata as { size?: number } | null)?.size),
              <a
                key="d"
                href={`/pos/backups/weekly?name=${encodeURIComponent(file.name)}`}
                className={cn(posButtonVariants({ variant: "secondary" }), "w-full sm:w-auto")}
              >
                <Download /> Download
              </a>,
            ])}
            empty={dumps.error ? "The list of weekly backups could not be read just now." : "No weekly cloud backups yet."}
          />
        </PosCard>

        <PosCard title="Recent backups" className="lg:col-span-2">
          <ReportTable
            columns={[
              { label: "When" },
              { label: "Where" },
              { label: "Result" },
              { label: "Size", numeric: true, wide: true },
              { label: "Records", numeric: true, wide: true },
              { label: "Details", wide: true },
            ]}
            rows={(runs ?? []).map((run) => {
              const rows = totalRows(run.row_counts);
              return [
                <span key="w" className="whitespace-nowrap">
                  {formatAccraDayTime(run.created_at)}
                </span>,
                KIND[run.kind] ?? run.kind,
                <Badge key="s" tone={run.status === "success" ? "up" : "down"}>
                  {run.status === "success" ? "Saved" : "Failed"}
                </Badge>,
                formatBytes(run.size_bytes),
                rows === null ? "" : rows.toLocaleString("en-GB"),
                <span key="d" className={cn("text-pos-text-muted", run.status === "failed" && "text-pos-down")}>
                  {[run.file_name, run.message].filter(Boolean).join(" · ")}
                </span>,
              ];
            })}
            empty="No backups yet."
          />
        </PosCard>
      </div>
    </main>
  );
}
