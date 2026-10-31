import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightLeft, Scissors, Wallet } from "lucide-react";
import { z } from "zod";

import { KpiTile } from "@/components/brand-pos/kpi-tile";
import { PageHeader } from "@/components/brand-pos/page-header";
import { PosCard } from "@/components/brand-pos/pos-card";
import { OwnerOnly } from "@/components/pos/owner-only";
import { AutoSelect } from "@/components/pos/reports/auto-select";
import { DownloadButton } from "@/components/pos/reports/download-button";
import { RangePicker } from "@/components/pos/reports/range-picker";
import { RangeTooLong, ReportTable } from "@/components/pos/reports/report-parts";
import { Badge } from "@/components/pos/sales/sale-badges";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { formatGhs } from "@/lib/money";
import { firstParam } from "@/lib/params";
import { isCalendarDate, isRangeTooLong, rangeFor, type RangePreset } from "@/lib/reports/range";
import { staffLeaderboardCsv, staffReportCsv } from "@/lib/reports/report-csv";
import { reportByStaff, reportStaffDetail } from "@/lib/reports/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, formatAccraDayTime, formatBusinessDate } from "@/lib/time";

export const metadata: Metadata = { title: "Staff report" };

const PRESETS = ["today", "week", "month", "30d", "custom"] as const satisfies readonly RangePreset[];
const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

// The receipt (a link to the sale) with when it was paid underneath, so the
// table still fits a phone.
function SaleCell({ saleId, receiptNo, paidAt }: { saleId: string; receiptNo: string; paidAt: string }) {
  return (
    <>
      <Link href={`/pos/sales/${saleId}`} className="font-medium whitespace-nowrap text-pos-accent underline-offset-4 hover:underline">
        {receiptNo}
      </Link>
      <span className="block text-xs whitespace-nowrap text-pos-text-muted">{formatAccraDayTime(paidAt)}</span>
    </>
  );
}

// Staff report (spec 16): a leaderboard of everyone for the range, and one
// staff member's work (by service, by day, every line, with reassignments
// marked). A reassigned line counts for whoever has it now.
export default async function StaffReportPage({ searchParams }: PageProps<"/pos/reports/staff">) {
  const { allowed } = await pageAccess("reports.view");
  if (!allowed) return <OwnerOnly />;

  const params = await searchParams;
  const preset = (PRESETS as readonly string[]).includes(firstParam(params.range)) ? (firstParam(params.range) as RangePreset) : "month";
  const from = isCalendarDate(firstParam(params.from)) ? firstParam(params.from) : "";
  const to = isCalendarDate(firstParam(params.to)) ? firstParam(params.to) : "";
  const requested = rangeFor(preset, accraDate(), from, to);
  const tooLong = isRangeTooLong(requested);
  const range = tooLong ? rangeFor("month", accraDate()) : requested;
  const staffId = z.uuid().safeParse(firstParam(params.staff)).success ? firstParam(params.staff) : "";

  const supabase = await createSupabaseServerClient();
  const [staffList, leaderboard] = await Promise.all([
    supabase.from("staff").select("id, name, archived_at").order("name"),
    reportByStaff(supabase, range),
  ]);
  const known = staffList.data?.some((member) => member.id === staffId) ?? false;
  const detail = known ? await reportStaffDetail(supabase, staffId, range) : null;
  const periodText = range.from === range.to ? formatBusinessDate(range.from) : `${formatBusinessDate(range.from)} to ${formatBusinessDate(range.to)}`;
  const periodQuery = preset === "custom" ? `range=custom&from=${range.from}&to=${range.to}` : `range=${preset}`;
  const staffHref = (id: string) => `/pos/reports/staff?staff=${id}&${periodQuery}`;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8 print:p-0">
      <PageHeader
        title={detail ? `${detail.staff.name}` : "Staff report"}
        description={periodText}
        actions={
          <>
            {/* The key remounts the form when a link changes the URL, so it shows the new choice. */}
            <RangePicker
              key={`${staffId}|${preset}|${requested.from}|${requested.to}`}
              action="/pos/reports/staff"
              presets={PRESETS}
              range={preset}
              from={requested.from}
              to={requested.to}
            >
              <AutoSelect
                name="staff"
                label="Staff member"
                value={known ? staffId : ""}
                options={[
                  { value: "", label: "All staff (leaderboard)" },
                  ...(staffList.data ?? []).map((member) => ({ value: member.id, label: member.archived_at ? `${member.name} (removed)` : member.name })),
                ]}
              />
            </RangePicker>
            <DownloadButton
              content={detail ? staffReportCsv(detail, range) : staffLeaderboardCsv(leaderboard, range)}
              filename={`staff-${detail ? detail.staff.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : "leaderboard"}-${range.from}-to-${range.to}.csv`}
              type="text/csv;charset=utf-8"
              label="CSV"
            />
          </>
        }
      />
      {tooLong && <RangeTooLong showing="this month" />}

      {detail && (
        <>
          <section aria-label="Totals" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile label="Services done" icon={<Scissors />} value={detail.services} />
            <KpiTile label="Revenue from services" icon={<Wallet />} value={formatGhs(detail.revenue)} />
            <KpiTile label="Average per service" value={formatGhs(detail.average_per_service)} />
            <KpiTile label="Custom items" value={formatGhs(detail.custom_revenue)} caption="Products or extras on their lines" />
          </section>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PosCard title="By service">
              <ReportTable
                columns={[{ label: "Service" }, { label: "Times", numeric: true }, { label: "Revenue", numeric: true }]}
                rows={detail.by_service.map((row) => [row.name, row.times, formatGhs(row.revenue)])}
                empty="No services in this period."
              />
            </PosCard>
            <PosCard title="By day">
              <ReportTable
                columns={[{ label: "Day" }, { label: "Services", numeric: true }, { label: "Revenue", numeric: true }]}
                rows={detail.by_day
                  .filter((row) => row.services > 0)
                  .map((row) => [shortDay.format(new Date(`${row.date}T00:00:00Z`)), row.services, formatGhs(row.revenue)])}
                empty="No services in this period."
              />
            </PosCard>
            <PosCard title="Their lines" className="lg:col-span-2">
              <ReportTable
                columns={[{ label: "Sale" }, { label: "Service" }, { label: "Amount", numeric: true }, { label: "Note", wide: true }]}
                rows={detail.lines.map((line) => [
                  <SaleCell key="s" saleId={line.sale_id} receiptNo={line.receipt_no} paidAt={line.paid_at} />,
                  <span key="s" className="inline-flex flex-wrap items-center gap-1">
                    {line.name}
                    {line.quantity > 1 && <span className="text-pos-text-muted">×{line.quantity}</span>}
                    {line.custom && <Badge tone="muted">Custom</Badge>}
                    {line.reassigned_from && (
                      <Badge tone="accent">
                        <ArrowRightLeft aria-hidden className="mr-1 h-3 w-3" />
                        From {line.reassigned_from}
                      </Badge>
                    )}
                  </span>,
                  formatGhs(line.line_total),
                  line.reassigned_from
                    ? `Moved by ${line.reassigned_by ?? "?"}${line.reassign_reason ? `: ${line.reassign_reason}` : ""}`
                    : line.price_changed
                      ? "Price changed"
                      : "",
                ])}
                empty="No lines in this period."
              />
            </PosCard>
            {detail.moved_away.length > 0 && (
              <PosCard title="Moved to someone else" className="lg:col-span-2">
                <p className="-mt-2 mb-3 text-sm text-pos-text-muted">These were first recorded for {detail.staff.name} and no longer count for them.</p>
                <ReportTable
                  columns={[{ label: "Sale" }, { label: "Service" }, { label: "Now with" }, { label: "Reason", wide: true }]}
                  rows={detail.moved_away.map((row) => [
                    <SaleCell key="s" saleId={row.sale_id} receiptNo={row.receipt_no} paidAt={row.paid_at} />,
                    row.name,
                    row.to_name ?? "?",
                    `${row.moved_by ?? "?"}${row.reason ? `: ${row.reason}` : ""}`,
                  ])}
                />
              </PosCard>
            )}
          </div>
        </>
      )}

      <PosCard title="Leaderboard" className="mt-4">
        <ReportTable
          columns={[
            { label: "#", numeric: true },
            { label: "Staff" },
            { label: "Services", numeric: true },
            { label: "Revenue", numeric: true },
            { label: "Average", numeric: true, wide: true },
            { label: "Top service", wide: true },
          ]}
          rows={leaderboard.map((row, index) => [
            index + 1,
            <Link key="s" href={staffHref(row.staff_id)} className="font-medium text-pos-accent underline-offset-4 hover:underline">
              {row.name}
            </Link>,
            row.services,
            formatGhs(row.revenue),
            formatGhs(row.average_per_service),
            row.top_service.name ?? "—",
          ])}
          empty="No services done in this period."
        />
      </PosCard>
    </main>
  );
}
