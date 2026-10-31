import type { Metadata } from "next";
import { CalendarDays, DatabaseBackup, Download } from "lucide-react";

import { PageHeader } from "@/components/brand-pos/page-header";
import { posButtonVariants } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { OwnerOnly } from "@/components/pos/owner-only";
import { ReportTable } from "@/components/pos/reports/report-parts";
import { Badge } from "@/components/pos/sales/sale-badges";
import { pageAccess } from "@/lib/auth/require-pos-user";
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

const control =
  "h-11 rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base text-pos-text md:text-sm focus-visible:outline-2 focus-visible:outline-pos-accent";

// Backups (owner only). Spec 20 adds the manual downloads and the list of
// runs; spec 22 completes the page (warnings, weekly dumps).
export default async function BackupsPage() {
  const { allowed } = await pageAccess("backups.view");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const { data: runs } = await supabase
    .from("backup_runs")
    .select("id, kind, status, created_at, file_name, size_bytes, message")
    .order("created_at", { ascending: false })
    .limit(15);
  const today = accraDate();

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 md:p-8">
      <PageHeader title="Backups" description="Copies of the studio's records, and a way to take one now." />

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
