import { formatGhs } from "@/lib/money";
import type { DayReport } from "@/lib/reports/reports";
import { formatAccraDateTime, formatAccraTime, formatBusinessDate } from "@/lib/time";

// The end-of-day report as a self-contained HTML document (spec 16). The POS
// prints it, Close day downloads it (spec 17), and the PC backup saves it
// (spec 20), so it is a plain function with no React or POS layout: black and
// white, its own CSS, every value escaped.

export type DayReportPaper = "80mm" | "a4";

const METHOD = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" } as const;
const CHANNEL = { walk_in: "Walk-in", online_booking: "Online booking", phone_booking: "Phone booking" } as const;

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const e = (value: string | number | null | undefined) => escapeHtml(value === null || value === undefined ? "" : String(value));

function table(head: string[], rows: (string | number | null)[][], numeric: number[] = []): string {
  if (rows.length === 0) return `<p class="none">None.</p>`;
  const cell = (tag: "th" | "td", value: string | number | null, index: number) =>
    `<${tag}${numeric.includes(index) ? ' class="n"' : ""}>${e(value)}</${tag}>`;
  return `<table><thead><tr>${head.map((h, i) => cell("th", h, i)).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((value, i) => cell("td", value, i)).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const section = (title: string, content: string) => `<section><h2>${e(title)}</h2>${content}</section>`;

export function dayReportCss(paper: DayReportPaper): string {
  const narrow = paper === "80mm";
  return `
.day-report { color: #000; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: ${narrow ? "11px" : "10.5pt"}; line-height: 1.35; ${narrow ? "width: 72mm;" : "max-width: 180mm;"} margin: 0 auto; }
.day-report h1 { font-size: ${narrow ? "15px" : "17pt"}; margin: 0; text-transform: uppercase; letter-spacing: 0.03em; }
.day-report h2 { font-size: ${narrow ? "12px" : "11.5pt"}; margin: 0 0 4px; padding-bottom: 2px; border-bottom: 1px solid #000; text-transform: uppercase; letter-spacing: 0.03em; }
.day-report section { margin-top: ${narrow ? "10px" : "14px"}; break-inside: avoid; }
.day-report .meta { margin: 2px 0 0; }
.day-report .figures { display: grid; grid-template-columns: ${narrow ? "1fr" : "repeat(3, 1fr)"}; gap: ${narrow ? "2px" : "4px 12px"}; }
.day-report .figures span:last-child { white-space: nowrap; }
.day-report .figures div { display: flex; justify-content: space-between; gap: 6px; border-bottom: 1px dotted #000; }
.day-report .total { font-weight: bold; font-size: ${narrow ? "13px" : "12pt"}; }
.day-report table { width: 100%; border-collapse: collapse; }
.day-report th, .day-report td { text-align: left; vertical-align: top; padding: 2px 4px 2px 0; border-bottom: 1px solid #ccc; }
.day-report th { font-weight: bold; border-bottom: 1px solid #000; }
.day-report .n { text-align: right; white-space: nowrap; }
.day-report .none { margin: 0; font-style: italic; }
.day-report .flag { font-weight: bold; }
.day-report footer { margin-top: 12px; font-size: 0.85em; }
`;
}

export function dayReportBody(day: DayReport): string {
  const f = day.figures;
  const activeClose = day.day_closes.find((close) => close.active) ?? null;

  const cashUp = day.day_closes.length
    ? day.day_closes
        .map(
          (close) => `<div class="figures">
<div><span>Opening float</span><span>${e(formatGhs(close.opening_float))}</span></div>
<div><span>Expected cash</span><span>${e(formatGhs(close.expected_cash))}</span></div>
<div><span>Counted cash</span><span>${e(formatGhs(close.counted_cash))}</span></div>
<div class="total"><span>Difference</span><span>${e(formatGhs(close.cash_difference))}</span></div>
<div><span>MoMo reported</span><span>${e(close.momo_reported === null ? "Not given" : formatGhs(close.momo_reported))}</span></div>
<div><span>MoMo in the POS</span><span>${e(formatGhs(close.expected_momo))}</span></div>
</div><p class="meta">Closed by ${e(close.closed_by ?? "?")} at ${e(formatAccraDateTime(close.closed_at))}${
            close.active ? "" : `. <span class="flag">Reopened</span> by ${e(close.reopened_by ?? "?")}${close.reopen_reason ? `: ${e(close.reopen_reason)}` : ""}`
          }${close.opening_float_reason ? `. Float: ${e(close.opening_float_reason)}` : ""}${close.note ? `. Note: ${e(close.note)}` : ""}</p>`,
        )
        .join("")
    : `<p class="none">This day is not closed yet.</p>`;

  const sales = day.sales.map((sale) => [
    formatAccraTime(sale.paid_at),
    `${sale.receipt_no}${sale.status === "voided" ? " VOIDED" : ""}${sale.is_backdated ? " (past sale)" : ""}${sale.after_close ? " (after close)" : ""}`,
    sale.items.map((item) => `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}${item.staff_name ? ` (${item.staff_name})` : ""}`).join(", "),
    sale.payments.map((payment) => METHOD[payment.method]).join(" + "),
    formatGhs(sale.total),
  ]);

  return `<article class="day-report">
<header>
<h1>${e(day.studio_name ?? "Bestman Luxe Studio")}</h1>
<p class="meta"><strong>End-of-day report: ${e(formatBusinessDate(day.business_date))}</strong></p>
<p class="meta">${activeClose ? "Day closed" : "Day not closed yet"} · made ${e(formatAccraDateTime(day.generated_at))}</p>
</header>
${section(
  "Totals",
  `<div class="figures">
<div class="total"><span>Revenue</span><span>${e(formatGhs(f.revenue))}</span></div>
<div><span>Sales</span><span>${f.sales_count}</span></div>
<div><span>Services done</span><span>${f.services_count}</span></div>
<div><span>Customers served</span><span>${f.customers_served}</span></div>
<div><span>Average sale</span><span>${e(formatGhs(f.average_sale))}</span></div>
<div><span>Discounts</span><span>${e(formatGhs(f.discounts))}</span></div>
</div>`,
)}
${section("Cash-up", cashUp)}
${section("Payments", table(["Method", "Sales", "Amount"], day.by_payment_method.filter((row) => row.amount !== 0 || row.method !== "other").map((row) => [METHOD[row.method], row.sales_count, formatGhs(row.amount)]), [1, 2]))}
${section("Staff (compare with the STAFF COPY slips)", table(["Staff", "Services", "Revenue"], day.by_staff.map((row) => [row.name, row.services, formatGhs(row.revenue)]), [1, 2]))}
${section("Services", table(["Service", "Times", "Revenue"], day.by_service.map((row) => [row.name, row.times, formatGhs(row.revenue)]), [1, 2]))}
${section("Channels", table(["Channel", "Sales", "Revenue"], day.by_channel.map((row) => [CHANNEL[row.channel], row.sales_count, formatGhs(row.revenue)]), [1, 2]))}
${section("Sales", table(["Time", "Receipt", "Services (staff)", "Paid by", "Amount"], sales, [4]))}
${section("Voided sales", table(["Receipt", "Reason", "By", "Amount"], day.voids.map((row) => [row.receipt_no, row.void_reason, row.voided_by, formatGhs(row.total)]), [3]))}
${section("Void requests", table(["Receipt", "Asked by", "Reason", "Status"], day.void_requests.map((row) => [row.receipt_no, row.requested_by, row.reason, row.status]), []))}
${section("Past sales", table(["Receipt", "Happened", "Entered by", "Amount"], day.backdated.map((row) => [row.receipt_no, formatAccraDateTime(row.paid_at), row.recorded_by, formatGhs(row.total)]), [3]))}
${section("Sales after close", table(["Receipt", "Entered", "Entered by", "Amount"], day.after_close.map((row) => [row.receipt_no, formatAccraDateTime(row.recorded_at), row.recorded_by, formatGhs(row.total)]), [3]))}
<footer>Voided sales are listed but not counted. Every figure comes from the POS report functions.</footer>
</article>`;
}

// The whole file, as downloaded and as saved by the PC backup.
export function dayReportHtml(day: DayReport, paper: DayReportPaper = "a4"): string {
  const page = paper === "80mm" ? "@page { size: 80mm 297mm; margin: 4mm; }" : "@page { size: A4; margin: 14mm; }";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>End-of-day report ${e(day.business_date)}</title>
<style>${page}
body { margin: 0; padding: 12px; background: #fff; }
@media print { body { padding: 0; } }
${dayReportCss(paper)}</style>
</head>
<body>
${dayReportBody(day)}
</body>
</html>
`;
}
