import Link from "next/link";

import { PosCard } from "@/components/brand-pos/pos-card";
import { ReportTable } from "@/components/pos/reports/report-parts";
import { Badge } from "@/components/pos/sales/sale-badges";
import { formatGhs } from "@/lib/money";
import type { DayReport, ReportDayClose } from "@/lib/reports/reports";
import { accraDate, formatAccraDateTime, formatAccraDayTime, formatAccraTime, formatBusinessDate } from "@/lib/time";
import { cn } from "@/lib/utils";

// Step 2 of Close day (spec 17), shown only once the count is saved: counted,
// expected, and the difference, then the day's figures to check against the
// drawer, the MoMo phone, and the staff's STAFF COPY slips.

type Close = DayReport["day_closes"][number];

const METHOD = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" } as const;
const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

function signedGhs(pesewas: number): string {
  return pesewas > 0 ? `+${formatGhs(pesewas)}` : formatGhs(pesewas);
}

function differenceText(difference: number): string {
  if (difference === 0) return "The drawer matches the POS.";
  return difference < 0 ? "Cash is missing from the drawer." : "There is more cash than the POS expected.";
}

function Figure({ label, value, caption, className }: { label: string; value: string; caption?: string; className?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-pos-text-muted">{label}</p>
      <p className={cn("display-type mt-1 text-5xl leading-none whitespace-nowrap", className)}>{value}</p>
      {caption && <p className="mt-1.5 text-xs text-pos-text-muted">{caption}</p>}
    </div>
  );
}

export function CloseResult({ day, close }: { day: DayReport; close: Close }) {
  const payments = day.by_payment_method.filter((row) => row.method !== "other" || row.amount !== 0);
  const momoMatches = close.momo_reported === null || close.momo_reported === close.expected_momo;
  return (
    <>
      <section aria-label="Cash count" className="rounded-[16px] border border-pos-border bg-pos-surface p-5 md:p-6">
        <div className="grid gap-5 xl:grid-cols-3">
          <Figure label="Counted" value={formatGhs(close.counted_cash)} />
          <Figure label="Expected" value={formatGhs(close.expected_cash)} caption={`Opening float ${formatGhs(close.opening_float)} + cash sales`} />
          <Figure
            label="Difference"
            value={signedGhs(close.cash_difference)}
            caption={differenceText(close.cash_difference)}
            className={close.cash_difference === 0 ? "text-pos-up" : "text-pos-down"}
          />
        </div>
        <p className="mt-5 border-t border-pos-border pt-4 text-sm text-pos-text-muted">
          Closed by {close.closed_by ?? "?"} at{" "}
          {accraDate(close.closed_at) === day.business_date ? formatAccraTime(close.closed_at) : formatAccraDateTime(close.closed_at)}.
          {close.opening_float_reason && ` Opening float: ${close.opening_float_reason}.`}
          {close.note && ` Note: ${close.note}`}
        </p>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PosCard title="Payments">
          <ReportTable
            columns={[{ label: "Method" }, { label: "Sales", numeric: true }, { label: "Amount", numeric: true }]}
            rows={payments.map((row) => [METHOD[row.method], row.sales_count, formatGhs(row.amount)])}
          />
          <dl className="mt-4 space-y-1.5 rounded-[10px] bg-pos-bg p-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-pos-text-muted">MoMo on the phone</dt>
              <dd className="tabular-nums">{close.momo_reported === null ? "Not given" : formatGhs(close.momo_reported)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-pos-text-muted">MoMo in the POS</dt>
              <dd className="tabular-nums">{formatGhs(close.expected_momo)}</dd>
            </div>
            {!momoMatches && <p className="pt-1 font-medium text-pos-down">The MoMo totals do not match.</p>}
          </dl>
        </PosCard>

        <PosCard title="Services per staff">
          <p className="-mt-2 mb-3 text-sm text-pos-text-muted">Compare with each person&apos;s STAFF COPY slips.</p>
          <ReportTable
            columns={[{ label: "Staff" }, { label: "Services", numeric: true }]}
            rows={day.by_staff.map((row) => [row.name, row.services])}
            empty="No services on this day."
          />
        </PosCard>

        <PosCard title="The day">
          <dl className="space-y-2 text-sm">
            {[
              ["Sales", String(day.figures.sales_count)],
              ["Services done", String(day.figures.services_count)],
              ["Revenue", formatGhs(day.figures.revenue)],
              ["Voided sales", String(day.voids.filter((row) => row.sold_in_period).length)],
              ["Card", formatGhs(close.expected_card)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 border-b border-pos-border pb-2 last:border-0">
                <dt className="text-pos-text-muted">{label}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </PosCard>
      </div>
    </>
  );
}

// The 80mm close slip: black and white, off-screen until printed (kept in the
// page so its height can be measured for the paper length).
export function CloseSlip({ day, close, studioName }: { day: DayReport; close: Close; studioName: string }) {
  const payments = day.by_payment_method.filter((row) => row.amount !== 0);
  const row = (label: string, value: string, bold = false) => (
    <div key={label} className={cn("flex justify-between gap-2", bold && "text-[14px] font-bold")}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
  return (
    <div
      aria-hidden
      className="close-slip pointer-events-none fixed top-0 left-[-10000px] w-[80mm] bg-white px-[4mm] pt-[3mm] pb-[6mm] font-sans text-[12px] leading-snug text-black print:static print:left-auto"
    >
      <p className="text-center text-[14px] font-bold uppercase">{studioName}</p>
      <p className="text-center font-bold">CLOSE SLIP</p>
      <p className="text-center">{formatBusinessDate(day.business_date)}</p>
      <p className="text-center">
        Closed by {close.closed_by ?? "?"}, {formatAccraDateTime(close.closed_at)}
      </p>
      <hr className="my-2 border-dashed border-black" />
      {row("Opening float", formatGhs(close.opening_float))}
      {row("Expected cash", formatGhs(close.expected_cash))}
      {row("Counted cash", formatGhs(close.counted_cash))}
      {row("DIFFERENCE", signedGhs(close.cash_difference), true)}
      <hr className="my-2 border-dashed border-black" />
      {row("MoMo on the phone", close.momo_reported === null ? "Not given" : formatGhs(close.momo_reported))}
      {row("MoMo in the POS", formatGhs(close.expected_momo))}
      {row("Card", formatGhs(close.expected_card))}
      <hr className="my-2 border-dashed border-black" />
      {row("Sales", String(day.figures.sales_count))}
      {row("Revenue", formatGhs(day.figures.revenue))}
      {payments.map((payment) => row(`${METHOD[payment.method]} (${payment.sales_count})`, formatGhs(payment.amount)))}
      <hr className="my-2 border-dashed border-black" />
      <p className="font-bold">Services per staff</p>
      {day.by_staff.length ? day.by_staff.map((staff) => row(staff.name, String(staff.services))) : <p>None</p>}
      {(close.opening_float_reason || close.note) && <hr className="my-2 border-dashed border-black" />}
      {close.opening_float_reason && <p>Float: {close.opening_float_reason}</p>}
      {close.note && <p>Note: {close.note}</p>}
      <hr className="my-2 border-dashed border-black" />
      <p className="mt-4">Counted by: ____________________</p>
      <p className="mt-4">Checked by: ____________________</p>
    </div>
  );
}

// Owner: every close in the last weeks, reopened ones included.
export function PastCloses({ closes }: { closes: ReportDayClose }) {
  const sorted = [...closes].sort((a, b) => b.closed_at.localeCompare(a.closed_at));
  return (
    <PosCard title="Past closes" className="mt-4">
      <ReportTable
        columns={[
          { label: "Day" },
          { label: "Counted", numeric: true },
          { label: "Expected", numeric: true, wide: true },
          { label: "Difference", numeric: true },
        ]}
        rows={sorted.map((close) => [
          <div key="d" className="min-w-0">
            <Link
              href={`/pos/close-day?date=${close.business_date}`}
              className="font-medium whitespace-nowrap text-pos-accent underline-offset-4 hover:underline"
            >
              {shortDay.format(new Date(`${close.business_date}T00:00:00Z`))}
            </Link>
            <span className="block text-xs text-pos-text-muted">
              {close.closed_by ?? "?"}, {formatAccraDayTime(close.closed_at)}
            </span>
            {!close.active && (
              <span className="mt-1 block text-xs">
                <Badge tone="warning">Reopened</Badge> by {close.reopened_by ?? "?"}
                {close.reopen_reason ? `: ${close.reopen_reason}` : ""}
              </span>
            )}
          </div>,
          formatGhs(close.counted_cash),
          formatGhs(close.expected_cash),
          <span key="x" className={cn("font-medium", close.cash_difference === 0 ? "text-pos-up" : "text-pos-down")}>
            {signedGhs(close.cash_difference)}
          </span>,
        ])}
        empty="No day has been closed in the last 60 days."
      />
    </PosCard>
  );
}
