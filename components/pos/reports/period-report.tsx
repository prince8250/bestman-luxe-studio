import type { ReactNode } from "react";
import Link from "next/link";
import { BadgeCheck, Percent, Receipt, Scissors, ShoppingBag, Wallet } from "lucide-react";

import { KpiTile } from "@/components/brand-pos/kpi-tile";
import { PageHeader } from "@/components/brand-pos/page-header";
import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { DownloadButton } from "@/components/pos/reports/download-button";
import { PeriodNav, ReportTable } from "@/components/pos/reports/report-parts";
import { Badge } from "@/components/pos/sales/sale-badges";
import { formatGhs } from "@/lib/money";
import { percentChangeOf } from "@/lib/reports/change";
import { dayReportHtml } from "@/lib/reports/day-report-html";
import type { PeriodReport } from "@/lib/reports/period";
import type { Period } from "@/lib/reports/periods";
import { dayReportCsv, periodReportCsv } from "@/lib/reports/report-csv";
import { formatAccraDateTime, formatAccraDayTime, formatAccraTime, formatBusinessDate } from "@/lib/time";
import { cn } from "@/lib/utils";

const METHOD = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" } as const;
const CHANNEL = { walk_in: "Walk-in", online_booking: "Online booking", phone_booking: "Phone booking" } as const;
const REQUEST_STATUS = { pending: "Waiting", approved: "Approved", rejected: "Rejected", cancelled: "Withdrawn" } as const;
const NOUN = { daily: "day", weekly: "week", monthly: "month", custom: "period" } as const;
const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

interface PeriodReportViewProps {
  title: string;
  basePath: string;
  period: Period;
  report: PeriodReport;
  studioName: string;
  /** The form to pick another day, week, month, or range. */
  picker: ReactNode;
  /** A message under the header (for example a range that was too long). */
  notice?: ReactNode;
}

const money = (pesewas: number) => formatGhs(pesewas);
const receiptLink = (saleId: string, receiptNo: string) => (
  <Link href={`/pos/sales/${saleId}`} className="font-medium whitespace-nowrap text-pos-accent underline-offset-4 hover:underline">
    {receiptNo}
  </Link>
);

// Day, week, month, or custom report (spec 16): totals against the previous
// period, then every breakdown and every exception, from the spec 14
// functions. The daily report adds the full list of sales and the end-of-day
// report (print, HTML, CSV), which is the same file the PC backup saves.
export function PeriodReportView({ title, basePath, period, report, studioName, picker, notice }: PeriodReportViewProps) {
  const { current, previous } = report.summary;
  const day = report.day;
  const csv = day ? dayReportCsv(day) : periodReportCsv(report, `${title}: ${period.label}`, studioName);
  const fileStem = `${period.kind === "custom" ? "report" : period.kind}-${report.range.from}${report.range.from === report.range.to ? "" : `-to-${report.range.to}`}`;
  const vs = (value: string) => `vs ${value} the ${NOUN[period.kind]} before`;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8 print:p-0">
      <PageHeader
        title={title}
        description={period.label}
        actions={
          <>
            {period.kind !== "custom" && <PeriodNav basePath={basePath} previous={period.previous} next={period.next} label={NOUN[period.kind]} />}
            <div className="print:hidden">{picker}</div>
            <DownloadButton content={csv} filename={`${fileStem}.csv`} type="text/csv;charset=utf-8" label="CSV" />
            {day && (
              <>
                <DownloadButton content={dayReportHtml(day, "a4")} filename={`${fileStem}.html`} type="text/html;charset=utf-8" label="HTML" />
                <PosButton asChild className="print:hidden">
                  <Link href={`/pos/day-report/${day.business_date}`}>
                    <Receipt /> Print end-of-day report
                  </Link>
                </PosButton>
              </>
            )}
          </>
        }
      />
      {notice}

      <section aria-label="Totals" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile label="Revenue" icon={<Wallet />} value={money(current.revenue)} change={percentChangeOf(current.revenue, previous.revenue)} caption={vs(money(previous.revenue))} />
        <KpiTile label="Sales" icon={<ShoppingBag />} value={current.sales_count} change={percentChangeOf(current.sales_count, previous.sales_count)} caption={vs(String(previous.sales_count))} />
        <KpiTile label="Services done" icon={<Scissors />} value={current.services_count} change={percentChangeOf(current.services_count, previous.services_count)} caption={vs(String(previous.services_count))} />
        <KpiTile label="Customers served" icon={<BadgeCheck />} value={current.customers_served} change={percentChangeOf(current.customers_served, previous.customers_served)} caption={vs(String(previous.customers_served))} />
        <KpiTile label="Average sale" value={money(current.average_sale)} change={percentChangeOf(current.average_sale, previous.average_sale)} caption={vs(money(previous.average_sale))} />
        <KpiTile label="Discounts" icon={<Percent />} value={money(current.discounts)} caption={vs(money(previous.discounts))} />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PosCard title="Cash-up" className="lg:col-span-2">
          <ReportTable
            columns={[
              { label: "Day" },
              { label: "Float", numeric: true, wide: true },
              { label: "Expected", numeric: true, wide: true },
              { label: "Counted", numeric: true },
              { label: "Difference", numeric: true },
              { label: "MoMo reported / in POS", numeric: true, wide: true },
              { label: "Closed by", wide: true },
            ]}
            rows={report.dayCloses.map((close) => [
              <span key="d" className="whitespace-nowrap">
                {shortDay.format(new Date(`${close.business_date}T00:00:00Z`))}
                {!close.active && (
                  <Badge tone="muted" className="ml-1.5">
                    Reopened
                  </Badge>
                )}
              </span>,
              money(close.opening_float),
              money(close.expected_cash),
              money(close.counted_cash),
              <span key="x" className={cn("font-medium", close.cash_difference === 0 ? "text-pos-up" : "text-pos-down")}>
                {money(close.cash_difference)}
              </span>,
              `${close.momo_reported === null ? "—" : money(close.momo_reported)} / ${money(close.expected_momo)}`,
              `${close.closed_by ?? "?"}, ${formatAccraTime(close.closed_at)}`,
            ])}
            empty={period.kind === "daily" ? "This day is not closed yet." : "No day was closed in this period."}
          />
        </PosCard>

        <PosCard title="Payment methods">
          <ReportTable
            columns={[{ label: "Method" }, { label: "Sales", numeric: true }, { label: "Amount", numeric: true }]}
            rows={report.payments.filter((row) => row.method !== "other" || row.amount !== 0).map((row) => [METHOD[row.method], row.sales_count, money(row.amount)])}
          />
        </PosCard>

        <PosCard title="Channels">
          <ReportTable
            columns={[{ label: "Channel" }, { label: "Sales", numeric: true }, { label: "Revenue", numeric: true }]}
            rows={report.channels.map((row) => [CHANNEL[row.channel], row.sales_count, money(row.revenue)])}
          />
        </PosCard>

        <PosCard title="Staff">
          <ReportTable
            columns={[{ label: "Staff" }, { label: "Services", numeric: true }, { label: "Revenue", numeric: true }, { label: "Top service", wide: true }]}
            rows={report.staff.map((row) => [
              <Link key="s" href={`/pos/reports/staff?staff=${row.staff_id}&range=custom&from=${report.range.from}&to=${report.range.to}`} className="font-medium text-pos-accent underline-offset-4 hover:underline">
                {row.name}
              </Link>,
              row.services,
              money(row.revenue),
              row.top_service.name ?? "—",
            ])}
            empty="No services done in this period."
          />
        </PosCard>

        <PosCard title="Categories">
          <ReportTable
            columns={[{ label: "Category" }, { label: "Times", numeric: true }, { label: "Revenue", numeric: true }]}
            rows={report.categories.map((row) => [row.name, row.times, money(row.revenue)])}
          />
        </PosCard>

        <PosCard title="Services" className="lg:col-span-2">
          <ReportTable
            columns={[{ label: "Service" }, { label: "Category", wide: true }, { label: "Times", numeric: true }, { label: "Revenue", numeric: true }]}
            rows={report.services.map((row) => [row.name, row.category ?? "—", row.times, money(row.revenue)])}
          />
        </PosCard>

        <PosCard title="Counter accounts">
          <ReportTable
            columns={[
              { label: "Account" },
              { label: "Sales", numeric: true },
              { label: "Revenue", numeric: true },
              { label: "Overrides", numeric: true, wide: true },
              { label: "Void requests", numeric: true, wide: true },
            ]}
            rows={report.accounts.map((row) => [
              <span key="a">
                {row.name}
                {row.role === "owner" && <span className="text-xs text-pos-text-muted"> (owner)</span>}
              </span>,
              row.sales_count,
              money(row.revenue),
              row.overrides,
              row.void_requests,
            ])}
          />
        </PosCard>

        <PosCard title="Void requests">
          <ReportTable
            columns={[{ label: "Receipt" }, { label: "Asked by" }, { label: "Reason", wide: true }, { label: "Status" }]}
            rows={report.voidRequests.map((row) => [receiptLink(row.sale_id, row.receipt_no), row.requested_by ?? "?", row.reason, REQUEST_STATUS[row.status]])}
            empty="No void requests."
          />
        </PosCard>

        <PosCard title="Voided sales">
          <ReportTable
            columns={[{ label: "Receipt" }, { label: "Reason", wide: true }, { label: "By" }, { label: "Amount", numeric: true }]}
            rows={report.voids.map((row) => [
              <span key="r">
                {receiptLink(row.sale_id, row.receipt_no)}
                {!row.sold_in_period && <span className="block text-xs text-pos-text-muted">sold {formatBusinessDate(row.business_date)}</span>}
              </span>,
              row.void_reason ?? "—",
              row.voided_by ?? "?",
              money(row.total),
            ])}
            empty="No voids."
          />
        </PosCard>

        <PosCard title="Past sales and sales after close">
          <ReportTable
            columns={[{ label: "Receipt" }, { label: "Happened" }, { label: "Entered by", wide: true }, { label: "Amount", numeric: true }]}
            rows={[
              ...report.backdated.map((row) => [
                <span key="r">
                  {receiptLink(row.sale_id, row.receipt_no)} <Badge tone="muted">Past sale</Badge>
                </span>,
                formatAccraDayTime(row.paid_at),
                `${row.recorded_by ?? "?"}, ${formatAccraDateTime(row.recorded_at)}`,
                money(row.total),
              ]),
              ...report.afterClose.map((row) => [
                <span key="r">
                  {receiptLink(row.sale_id, row.receipt_no)} <Badge tone="muted">After close</Badge>
                </span>,
                formatAccraDayTime(row.paid_at),
                `${row.recorded_by ?? "?"}, ${formatAccraDateTime(row.recorded_at)}`,
                money(row.total),
              ]),
            ]}
            empty="None."
          />
        </PosCard>

        <PosCard title="Sales" className="lg:col-span-2">
          {day ? (
            <ReportTable
              columns={[
                { label: "Time", wide: true },
                { label: "Receipt" },
                { label: "Services (staff)" },
                { label: "Paid by", wide: true },
                { label: "Amount", numeric: true },
              ]}
              rows={day.sales.map((sale) => [
                formatAccraTime(sale.paid_at),
                <span key="r" className="inline-flex flex-wrap items-center gap-1">
                  {receiptLink(sale.sale_id, sale.receipt_no)}
                  {sale.status === "voided" && <Badge tone="down">Voided</Badge>}
                  {sale.is_backdated && <Badge tone="muted">Past sale</Badge>}
                  {sale.after_close && <Badge tone="muted">After close</Badge>}
                  {/* On a phone the Time column is hidden, so the time sits here. */}
                  <span className="w-full text-xs text-pos-text-muted sm:hidden">{formatAccraTime(sale.paid_at)}</span>
                </span>,
                sale.items.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}${item.staff_name ? ` (${item.staff_name})` : ""}`).join(", "),
                sale.payments.map((payment) => METHOD[payment.method]).join(" + "),
                <span key="t" className={cn(sale.status === "voided" && "text-pos-text-muted line-through")}>
                  {money(sale.total)}
                </span>,
              ])}
              empty="No sales on this day."
            />
          ) : (
            <p className="text-sm">
              {current.sales_count} paid {current.sales_count === 1 ? "sale" : "sales"} in this period.{" "}
              <Link
                href={`/pos/sales?range=custom&from=${report.range.from}&to=${report.range.to}`}
                className="font-medium text-pos-accent underline-offset-4 hover:underline"
              >
                See them in Sales
              </Link>
            </p>
          )}
        </PosCard>
      </div>
    </main>
  );
}
