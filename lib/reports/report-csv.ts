import { describeChange, type ChangeRow } from "@/lib/reports/changes";
import { percentChangeOf } from "@/lib/reports/change";
import { csvDateTime, csvMoney, toCsv, type CsvValue } from "@/lib/reports/csv";
import type { PeriodReport } from "@/lib/reports/period";
import type { DayReport, ReportByChannel, ReportByMethod, ReportByService, ReportByStaff, ReportStaffDetail } from "@/lib/reports/reports";
import type { DateRange } from "@/lib/reports/range";

// The CSV downloads of the Reports pages (spec 16). Excel-friendly: UTF-8
// with a byte-order mark, ISO dates, amounts in GHS with two decimals. The
// day report CSV is also what the PC backup saves (spec 20).

const METHOD = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" } as const;
const CHANNEL = { walk_in: "Walk-in", online_booking: "Online booking", phone_booking: "Phone booking" } as const;

const change = (current: number, previous: number): CsvValue => {
  const value = percentChangeOf(current, previous);
  return value === null ? "" : `${value}%`;
};

const methodRows = (rows: ReportByMethod): CsvValue[][] => [
  ["Payment method", "Amount (GHS)", "Sales"],
  ...rows.map((row) => [METHOD[row.method], csvMoney(row.amount), row.sales_count]),
];
const staffRows = (rows: ReportByStaff): CsvValue[][] => [
  ["Staff", "Services done", "Revenue (GHS)", "Average per service (GHS)", "Top service"],
  ...rows.map((row) => [row.name, row.services, csvMoney(row.revenue), csvMoney(row.average_per_service), row.top_service.name]),
];
const serviceRows = (rows: ReportByService): CsvValue[][] => [
  ["Service", "Category", "Times done", "Revenue (GHS)"],
  ...rows.map((row) => [row.name, row.category, row.times, csvMoney(row.revenue)]),
];
const channelRows = (rows: ReportByChannel): CsvValue[][] => [
  ["Channel", "Sales", "Revenue (GHS)"],
  ...rows.map((row) => [CHANNEL[row.channel], row.sales_count, csvMoney(row.revenue)]),
];

function exceptionRows(report: Pick<DayReport, "voids" | "backdated" | "after_close" | "void_requests" | "day_closes">): CsvValue[][] {
  return [
    ["Voided sales", "Receipt", "Sold", "Voided", "Voided by", "Reason", "Amount (GHS)"],
    ...report.voids.map((row) => ["", row.receipt_no, csvDateTime(row.paid_at), row.voided_at ? csvDateTime(row.voided_at) : "", row.voided_by, row.void_reason, csvMoney(row.total)]),
    [],
    ["Past sales", "Receipt", "Happened", "Entered", "Entered by", "Status", "Amount (GHS)"],
    ...report.backdated.map((row) => ["", row.receipt_no, csvDateTime(row.paid_at), csvDateTime(row.recorded_at), row.recorded_by, row.status, csvMoney(row.total)]),
    [],
    ["Sales after close", "Receipt", "Happened", "Entered", "Entered by", "Status", "Amount (GHS)"],
    ...report.after_close.map((row) => ["", row.receipt_no, csvDateTime(row.paid_at), csvDateTime(row.recorded_at), row.recorded_by, row.status, csvMoney(row.total)]),
    [],
    ["Void requests", "Receipt", "Asked", "Asked by", "Reason", "Status", "Decided by", "Decided", "Note"],
    ...report.void_requests.map((row) => [
      "",
      row.receipt_no,
      csvDateTime(row.requested_at),
      row.requested_by,
      row.reason,
      row.status,
      row.decided_by,
      row.decided_at ? csvDateTime(row.decided_at) : "",
      row.decision_note,
    ]),
    [],
    ["Cash-up", "Day", "Opening float (GHS)", "Expected cash (GHS)", "Counted (GHS)", "Difference (GHS)", "MoMo reported (GHS)", "MoMo expected (GHS)", "Closed by", "Closed", "Reopened"],
    ...report.day_closes.map((row) => [
      "",
      row.business_date,
      csvMoney(row.opening_float),
      csvMoney(row.expected_cash),
      csvMoney(row.counted_cash),
      csvMoney(row.cash_difference),
      row.momo_reported === null ? "" : csvMoney(row.momo_reported),
      csvMoney(row.expected_momo),
      row.closed_by,
      csvDateTime(row.closed_at),
      row.active ? "" : `Yes${row.reopen_reason ? `: ${row.reopen_reason}` : ""}`,
    ]),
  ];
}

// The end-of-day report as CSV (shared with the PC backup, spec 20).
export function dayReportCsv(day: DayReport): string {
  const f = day.figures;
  return toCsv([
    [day.studio_name ?? "Bestman Luxe Studio", "End-of-day report", day.business_date],
    ["Made", csvDateTime(day.generated_at)],
    [],
    ["Revenue (GHS)", csvMoney(f.revenue)],
    ["Sales", f.sales_count],
    ["Services done", f.services_count],
    ["Customers served", f.customers_served],
    ["Average sale (GHS)", csvMoney(f.average_sale)],
    ["Discounts (GHS)", csvMoney(f.discounts)],
    [],
    ...methodRows(day.by_payment_method),
    [],
    ...staffRows(day.by_staff),
    [],
    ...serviceRows(day.by_service),
    [],
    ...channelRows(day.by_channel),
    [],
    ["Sales", "Time", "Receipt", "Status", "Services", "Payments", "Amount (GHS)", "Recorded by", "Notes"],
    ...day.sales.map((sale) => [
      "",
      csvDateTime(sale.paid_at),
      sale.receipt_no,
      sale.status,
      sale.items.map((item) => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}${item.staff_name ? ` (${item.staff_name})` : ""}`).join("; "),
      sale.payments.map((payment) => `${METHOD[payment.method]} ${csvMoney(payment.amount)}`).join("; "),
      csvMoney(sale.total),
      sale.recorded_by,
      [sale.is_backdated ? "past sale" : "", sale.after_close ? "after close" : ""].filter(Boolean).join(", "),
    ]),
    [],
    ...exceptionRows(day),
  ]);
}

// A week, month, or custom report as CSV.
export function periodReportCsv(report: PeriodReport, title: string, studioName: string): string {
  const { current, previous } = report.summary;
  return toCsv([
    [studioName, title],
    ["Period", `${report.range.from} to ${report.range.to}`],
    ["Previous period", `${report.summary.previous_from} to ${report.summary.previous_to}`],
    [],
    ["Figure", "This period", "Previous period", "Change"],
    ["Revenue (GHS)", csvMoney(current.revenue), csvMoney(previous.revenue), change(current.revenue, previous.revenue)],
    ["Sales", current.sales_count, previous.sales_count, change(current.sales_count, previous.sales_count)],
    ["Services done", current.services_count, previous.services_count, change(current.services_count, previous.services_count)],
    ["Customers served", current.customers_served, previous.customers_served, change(current.customers_served, previous.customers_served)],
    ["Average sale (GHS)", csvMoney(current.average_sale), csvMoney(previous.average_sale), change(current.average_sale, previous.average_sale)],
    ["Discounts (GHS)", csvMoney(current.discounts), csvMoney(previous.discounts), ""],
    [],
    ...methodRows(report.payments),
    [],
    ["Category", "Times done", "Revenue (GHS)"],
    ...report.categories.map((row) => [row.name, row.times, csvMoney(row.revenue)]),
    [],
    ...serviceRows(report.services),
    [],
    ...staffRows(report.staff),
    [],
    ...channelRows(report.channels),
    [],
    ["Account", "Role", "Sales", "Revenue (GHS)", "Price overrides", "Void requests"],
    ...report.accounts.map((row) => [row.name, row.role, row.sales_count, csvMoney(row.revenue), row.overrides, row.void_requests]),
    [],
    ...exceptionRows({
      voids: report.voids,
      backdated: report.backdated,
      after_close: report.afterClose,
      void_requests: report.voidRequests,
      day_closes: report.dayCloses,
    }),
  ]);
}

export function staffLeaderboardCsv(rows: ReportByStaff, range: DateRange): string {
  return toCsv([["Staff leaderboard", `${range.from} to ${range.to}`], [], ...staffRows(rows)]);
}

export function staffReportCsv(detail: ReportStaffDetail, range: DateRange): string {
  return toCsv([
    [detail.staff.name, "Staff report"],
    ["Period", `${range.from} to ${range.to}`],
    ["Services done", detail.services],
    ["Revenue (GHS)", csvMoney(detail.revenue)],
    ["Average per service (GHS)", csvMoney(detail.average_per_service)],
    ["Custom items (GHS)", csvMoney(detail.custom_revenue)],
    [],
    ["Service", "Times done", "Revenue (GHS)"],
    ...detail.by_service.map((row) => [row.name, row.times, csvMoney(row.revenue)]),
    [],
    ["Day", "Services done", "Revenue (GHS)"],
    ...detail.by_day.map((row) => [row.date, row.services, csvMoney(row.revenue)]),
    [],
    ["Lines", "Time", "Receipt", "Service", "Quantity", "Amount (GHS)", "Reassigned from", "Reason"],
    ...detail.lines.map((row) => ["", csvDateTime(row.paid_at), row.receipt_no, row.name, row.quantity, csvMoney(row.line_total), row.reassigned_from, row.reassign_reason]),
    [],
    ["Moved to someone else", "Time", "Receipt", "Service", "Amount (GHS)", "Now with", "Moved by", "Reason"],
    ...detail.moved_away.map((row) => ["", csvDateTime(row.paid_at), row.receipt_no, row.name, csvMoney(row.line_total), row.to_name, row.moved_by, row.reason]),
  ]);
}

export function changesCsv(rows: (ChangeRow & { id: number })[], range: DateRange): string {
  return toCsv([
    ["Change log", `${range.from} to ${range.to}`],
    [],
    ["When", "Who", "Role", "Change", "Reason", "Action"],
    ...rows.map((row) => [csvDateTime(row.created_at), row.actor_name ?? "System", row.actor_role, describeChange(row), row.reason, row.action]),
  ]);
}
