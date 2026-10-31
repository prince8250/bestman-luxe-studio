import { describe, expect, it } from "vitest";

import { dayReportHtml, escapeHtml } from "./day-report-html";
import { dayReportCsv } from "./report-csv";
import type { DayReport } from "./reports";

const day: DayReport = {
  business_date: "2026-10-29",
  studio_name: "Bestman Luxe Studio",
  generated_at: "2026-10-29T20:45:00Z",
  figures: { revenue: 25000, sales_count: 2, services_count: 3, customers_served: 2, average_sale: 12500, discounts: 500 },
  by_payment_method: [
    { method: "cash", amount: 15000, sales_count: 1 },
    { method: "momo", amount: 10000, sales_count: 1 },
    { method: "card", amount: 0, sales_count: 0 },
    { method: "other", amount: 0, sales_count: 0 },
  ],
  by_staff: [{ staff_id: "k", name: "Kofi <b>", services: 3, revenue: 25000, average_per_service: 8333, top_service: { name: "Haircut", times: 2 } }],
  by_service: [{ service_id: "h", name: "Haircut", category: "Hair", custom: false, times: 2, revenue: 15000 }],
  by_channel: [{ channel: "walk_in", sales_count: 2, revenue: 25000 }],
  sales: [
    {
      sale_id: "s1",
      receipt_no: "BLS-000300",
      paid_at: "2026-10-29T10:05:00Z",
      status: "paid",
      total: 15000,
      channel: "walk_in",
      customer_name: null,
      customer_phone: null,
      is_backdated: true,
      after_close: false,
      recorded_by: "Abena",
      items: [{ name: "Haircut", quantity: 2, line_total: 15000, staff_name: "Kofi <b>" }],
      payments: [{ method: "cash", kind: "payment", amount: 15000 }],
    },
  ],
  voids: [],
  backdated: [],
  after_close: [],
  void_requests: [],
  day_closes: [
    {
      id: "c1",
      business_date: "2026-10-29",
      opening_float: 25000,
      opening_float_reason: null,
      expected_cash: 40000,
      counted_cash: 39500,
      cash_difference: -500,
      momo_reported: 10000,
      expected_momo: 10000,
      expected_card: 0,
      expected_other: 0,
      sales_count: 2,
      note: null,
      closed_by: "Abena",
      closed_at: "2026-10-29T20:40:00Z",
      active: true,
      reopened_by: null,
      reopened_at: null,
      reopen_reason: null,
    },
  ],
};

describe("dayReportHtml", () => {
  it("is a complete document for each paper size", () => {
    const a4 = dayReportHtml(day, "a4");
    expect(a4).toMatch(/^<!doctype html>/);
    expect(a4).toContain("@page { size: A4;");
    expect(dayReportHtml(day, "80mm")).toContain("@page { size: 80mm 297mm;");
  });

  it("shows the totals, the cash-up, and the sales", () => {
    const html = dayReportHtml(day);
    expect(html).toContain("End-of-day report: Thu 29 Oct 2026");
    expect(html).toContain("GHS 250.00");
    expect(html).toContain("<span>Difference</span><span>-GHS 5.00</span>");
    expect(html).toContain("BLS-000300 (past sale)");
    expect(html).toContain("<p class=\"none\">None.</p>");
  });

  it("escapes every value", () => {
    expect(dayReportHtml(day)).toContain("Kofi &lt;b&gt;");
    expect(dayReportHtml(day)).not.toContain("Kofi <b>");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });
});

describe("dayReportCsv", () => {
  it("writes ISO dates and GHS amounts with two decimals", () => {
    const lines = dayReportCsv(day).split("\r\n");
    expect(lines[0]).toBe("\uFEFFBestman Luxe Studio,End-of-day report,2026-10-29");
    expect(lines).toContain("Revenue (GHS),250.00");
    expect(lines).toContain(",2026-10-29 10:05,BLS-000300,paid,Haircut x2 (Kofi <b>),Cash 150.00,150.00,Abena,past sale");
    expect(lines).toContain(",2026-10-29,250.00,400.00,395.00,-5.00,100.00,100.00,Abena,2026-10-29 20:40,");
  });
});
