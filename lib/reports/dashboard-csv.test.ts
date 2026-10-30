import { describe, expect, it } from "vitest";

import type { DashboardData } from "./dashboard";
import { dashboardCsv } from "./dashboard-csv";

const figures = (revenue: number, sales: number) => ({
  revenue,
  sales_count: sales,
  services_count: sales,
  customers_served: sales,
  average_sale: sales ? Math.round(revenue / sales) : 0,
  discounts: 0,
});

const data: DashboardData = {
  range: { from: "2026-10-26", to: "2026-10-30" },
  previous: { from: "2026-10-21", to: "2026-10-25" },
  summary: {
    from: "2026-10-26",
    to: "2026-10-30",
    previous_from: "2026-10-21",
    previous_to: "2026-10-25",
    current: figures(125000, 10),
    previous: figures(100000, 8),
  },
  onlineBookings: { current: 0, previous: 0 },
  channels: [{ channel: "walk_in", sales_count: 10, revenue: 125000 }],
  chart: { range: { from: "2026-10-24", to: "2026-10-30" }, widened: true, current: [], previous: [] },
  busiest: { range: { from: "2026-10-03", to: "2026-10-30" }, widened: true, days: [] },
  repeat: { identified: 4, repeat: 1, rate: 0.25 },
  payments: [{ method: "cash", amount: 125000, sales_count: 10 }],
  topStaff: [{ staffId: "s1", name: "=Ama", title: null, photoUrl: null, services: 6, revenue: 90000, topService: "Haircuts" }],
  topServices: [{ service_id: "x", name: "Haircuts", category: "Hair", custom: false, times: 6, revenue: 48000 }],
  appointments: [],
};

describe("dashboardCsv", () => {
  it("writes the period, the comparison, and the breakdowns", () => {
    const csv = dashboardCsv(data, "Bestman Luxe Studio");
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[1]).toBe("Period,2026-10-26 to 2026-10-30");
    expect(lines).toContain("Revenue (GHS),1250.00,1000.00,25%");
    expect(lines).toContain("Online bookings (sales),0,0,");
    expect(lines).toContain("Cash,1250.00,10");
    expect(lines).toContain("Repeat customers,1,of,4,25%");
    // A name that looks like a formula is neutralised.
    expect(lines).toContain("'=Ama,6,900.00,Haircuts");
  });
});
