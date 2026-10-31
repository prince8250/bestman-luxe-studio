import type { Metadata } from "next";
import { CalendarDays, DatabaseBackup, Download } from "lucide-react";

import { PageHeader } from "@/components/brand-pos/page-header";
import { posButtonVariants } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { OwnerOnly } from "@/components/pos/owner-only";
import { ReportTable } from "@/components/pos/reports/report-parts";
import { Badge } from "@/components/pos/sales/sale-badges";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { isBackupStale } from "@/lib/backups/status";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, formatAccraDayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Backups" };

const KIND: Record<string, string> = { daily_pc: "Studio PC", weekly_cloud: "Weekly cloud", manual_download: "Downloaded in the POS" };

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "";
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

const control =
  "h-11 rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base text-pos-text md:text-sm focus-visible:outline-2 focus-visible:outline-pos-accent";

// Backups (owner only). Spec 20: the manual downloads and the list of runs;
// spec 21: the studio PC backup status; spec 22 completes the page (weekly
// cloud backups).
export default async function BackupsPage() {
  const { allowed } = await pageAccess("backups.view");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const [{ data: runs }, { data: lastPc }] = await Promise.all([
    supabase
      .from("backup_runs")
      .select("id, kind, status, created_at, file_name, size_bytes, message")
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("backup_runs")
      .select("created_at")
      .eq("kind", "daily_pc")
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const today = accraDate();
  const lastPcAt = lastPc?.created_at ?? null;
  const pcStale = isBackupStale("daily_pc", lastPcAt);

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 md:p-8">
      <PageHeader title="Backups" description="Copies of the studio's records, and a way to take one now." />

      {/* Spec 21: the studio PC backup at a glance, with a calm warning after 36 hours. */}
      <section
        aria-label="Studio PC backup"
        className={cn(
          "mb-4 rounded-[16px] border p-4 md:p-5",
          pcStale ? "border-pos-warning/40 bg-pos-warning-soft" : "border-pos-border bg-pos-surface",
        )}
      >
        <p className={cn("font-medium", pcStale && "text-pos-warning")}>
          {lastPcAt ? `Last studio PC backup: ${formatAccraDayTime(lastPcAt)} (${timeAgo(lastPcAt)})` : "No studio PC backup yet"}
        </p>
        <p className="mt-1 text-sm text-pos-text-muted">
          {!lastPcAt
            ? "Set up the backup on the studio PC (tools/pc-backup/README.md). Until then, use Download backup now."
            : pcStale
              ? "That is more than 36 hours ago. It is normal when the studio was closed and the PC was off (a Sunday or a holiday). Otherwise, check the studio PC: its log is backup-log.txt in the backup folder."
              : "The studio PC saves a full backup and the day report at log-on and every 2 hours while it is on."}
        </p>
      </section>

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

        <PosCard title="Recent backups" className="lg:col-span-2">
          <ReportTable
            columns={[{ label: "When" }, { label: "Where" }, { label: "Result" }, { label: "Size", numeric: true, wide: true }, { label: "Details", wide: true }]}
            rows={(runs ?? []).map((run) => [
              <span key="w" className="whitespace-nowrap">
                {formatAccraDayTime(run.created_at)}
              </span>,
              KIND[run.kind] ?? run.kind,
              <Badge key="s" tone={run.status === "success" ? "up" : "down"}>
                {run.status === "success" ? "Saved" : "Failed"}
              </Badge>,
              formatBytes(run.size_bytes),
              <span key="d" className={cn("text-pos-text-muted", run.status === "failed" && "text-pos-down")}>
                {[run.file_name, run.message].filter(Boolean).join(" · ")}
              </span>,
            ])}
            empty="No backups yet. The studio PC backup is set up in a later step."
          />
        </PosCard>
      </div>
    </main>
  );
}
