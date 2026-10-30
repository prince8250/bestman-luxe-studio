import type { DashboardData } from "@/lib/reports/dashboard";
import { csvMoney, toCsv, type CsvValue } from "@/lib/reports/csv";
import { percentChangeOf } from "@/lib/reports/change";

// The Dashboard's Export → CSV: the period summary, with the previous period
// for comparison, and the breakdowns shown on the page.

const METHOD = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" } as const;
const CHANNEL = { walk_in: "Walk-in", online_booking: "Online booking", phone_booking: "Phone booking" } as const;

function change(current: number, previous: number): CsvValue {
  const value = percentChangeOf(current, previous);
  return value === null ? "" : `${value}%`;
}

export function dashboardCsv(data: DashboardData, studioName: string): string {
  const { current, previous } = data.summary;
  const rows: CsvValue[][] = [
    [studioName, "Dashboard summary"],
    ["Period", `${data.range.from} to ${data.range.to}`],
    ["Previous period", `${data.previous.from} to ${data.previous.to}`],
    [],
    ["Figure", "This period", "Previous period", "Change"],
    ["Revenue (GHS)", csvMoney(current.revenue), csvMoney(previous.revenue), change(current.revenue, previous.revenue)],
    ["Sales", current.sales_count, previous.sales_count, change(current.sales_count, previous.sales_count)],
    ["Services done", current.services_count, previous.services_count, change(current.services_count, previous.services_count)],
    ["Customers served", current.customers_served, previous.customers_served, change(current.customers_served, previous.customers_served)],
    [
      "Online bookings (sales)",
      data.onlineBookings.current,
      data.onlineBookings.previous,
      change(data.onlineBookings.current, data.onlineBookings.previous),
    ],
    ["Average sale (GHS)", csvMoney(current.average_sale), csvMoney(previous.average_sale), change(current.average_sale, previous.average_sale)],
    ["Discounts (GHS)", csvMoney(current.discounts), csvMoney(previous.discounts), ""],
    [],
    ["Payment method", "Amount (GHS)", "Sales"],
    ...data.payments.map((row) => [METHOD[row.method], csvMoney(row.amount), row.sales_count]),
    [],
    ["Channel", "Sales", "Revenue (GHS)"],
    ...data.channels.map((row) => [CHANNEL[row.channel], row.sales_count, csvMoney(row.revenue)]),
    [],
    ["Repeat customers", data.repeat.repeat, "of", data.repeat.identified, data.repeat.rate === null ? "" : `${Math.round(data.repeat.rate * 100)}%`],
    [],
    ["Top staff", "Services done", "Revenue (GHS)", "Top service"],
    ...data.topStaff.map((row) => [row.name, row.services, csvMoney(row.revenue), row.topService]),
    [],
    ["Top services", "Times done", "Revenue (GHS)"],
    ...data.topServices.map((row) => [row.name, row.times, csvMoney(row.revenue)]),
  ];
  return toCsv(rows);
}
