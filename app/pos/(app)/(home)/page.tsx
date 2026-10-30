import type { Metadata } from "next";
import { BadgeCheck, CalendarCheck, Globe, Scissors, Wallet } from "lucide-react";

import { KpiTile } from "@/components/brand-pos/kpi-tile";
import { PageHeader } from "@/components/brand-pos/page-header";
import { PosCard } from "@/components/brand-pos/pos-card";
import { BusiestDaysChart } from "@/components/pos/dashboard/busiest-days-chart";
import { ChannelStrip, PaymentMethods, RepeatGauge, TodaysAppointments, TopServices, TopStaff } from "@/components/pos/dashboard/cards";
import { ExportButtons } from "@/components/pos/dashboard/export-buttons";
import { RevenueChart } from "@/components/pos/dashboard/revenue-chart";
import { OwnerOnly } from "@/components/pos/owner-only";
import { RangePicker } from "@/components/pos/reports/range-picker";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { formatGhs } from "@/lib/money";
import { percentChangeOf } from "@/lib/reports/change";
import { loadDashboard } from "@/lib/reports/dashboard";
import { dashboardCsv } from "@/lib/reports/dashboard-csv";
import { isCalendarDate, rangeFor, type RangePreset } from "@/lib/reports/range";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, formatBusinessDate } from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };

const PRESETS = ["today", "week", "month", "30d", "custom"] as const satisfies readonly RangePreset[];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function periodLabel(from: string, to: string): string {
  return from === to ? formatBusinessDate(from) : `${formatBusinessDate(from)} to ${formatBusinessDate(to)}`;
}

// The owner's Dashboard (spec 15), laid out like the reference: KPI tiles,
// revenue chart with the channel strip, busiest days, repeat customers, top
// staff and services, payment methods, today's appointments. Every figure
// comes from the spec 14 report functions (lib/reports).
export default async function DashboardPage({ searchParams }: PageProps<"/pos">) {
  const { allowed } = await pageAccess("dashboard.view");
  if (!allowed) return <OwnerOnly />;

  const params = await searchParams;
  const preset = (PRESETS as readonly string[]).includes(one(params.range)) ? (one(params.range) as RangePreset) : "today";
  const from = isCalendarDate(one(params.from)) ? one(params.from) : "";
  const to = isCalendarDate(one(params.to)) ? one(params.to) : "";
  const today = accraDate();
  const range = rangeFor(preset, today, from, to);

  const supabase = await createSupabaseServerClient();
  const [data, settings] = await Promise.all([
    loadDashboard(supabase, range, today),
    supabase.from("studio_settings").select("studio_name").eq("id", true).maybeSingle(),
  ]);
  const { current, previous } = data.summary;
  const vs = (value: string) => `vs ${value} the period before`;

  const revenuePoints = data.chart.current.map((day, index) => ({
    date: day.date,
    previousDate: data.chart.previous[index]?.date ?? null,
    current: day.revenue,
    previous: data.chart.previous[index]?.revenue ?? 0,
  }));
  const weekdayPoints = data.busiest.days.map((day) => ({
    weekday: day.weekday,
    name: day.name,
    days: day.days,
    revenue: day.revenue,
    services: day.services_count,
  }));

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8 print:p-0">
      <PageHeader
        title="Dashboard"
        description={periodLabel(range.from, range.to)}
        actions={
          <>
            <div className="print:hidden">
              <RangePicker action="/pos" presets={PRESETS} range={preset} from={range.from} to={range.to} />
            </div>
            <ExportButtons
              csv={dashboardCsv(data, settings.data?.studio_name ?? "Bestman Luxe Studio")}
              filename={`dashboard-${range.from}-to-${range.to}.csv`}
            />
          </>
        }
      />

      <section aria-label="Key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Revenue"
          icon={<Wallet />}
          value={formatGhs(current.revenue)}
          change={percentChangeOf(current.revenue, previous.revenue)}
          caption={vs(formatGhs(previous.revenue))}
        />
        <KpiTile
          label="Services done"
          icon={<Scissors />}
          value={current.services_count}
          change={percentChangeOf(current.services_count, previous.services_count)}
          caption={vs(String(previous.services_count))}
        />
        <KpiTile
          label="Customers served"
          icon={<BadgeCheck />}
          value={current.customers_served}
          change={percentChangeOf(current.customers_served, previous.customers_served)}
          caption={vs(String(previous.customers_served))}
        />
        <KpiTile
          label="Online bookings"
          icon={<Globe />}
          value={data.onlineBookings.current}
          change={percentChangeOf(data.onlineBookings.current, data.onlineBookings.previous)}
          caption={`Sales from online bookings · ${vs(String(data.onlineBookings.previous))}`}
        />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <PosCard title="Revenue" className="xl:col-span-2">
          <p className="-mt-2 mb-3 text-sm text-pos-text-muted">
            {data.chart.widened ? `The 7 days up to ${formatBusinessDate(range.to)}, by day` : "By day"}, with the period before as a dashed line.
          </p>
          <RevenueChart points={revenuePoints} />
          <ChannelStrip channels={data.channels} />
        </PosCard>

        <PosCard title="Busiest days">
          <p className="-mt-2 mb-3 text-sm text-pos-text-muted">
            {data.busiest.widened ? `The 4 weeks up to ${formatBusinessDate(range.to)}.` : periodLabel(data.busiest.range.from, data.busiest.range.to)}
          </p>
          <BusiestDaysChart points={weekdayPoints} />
        </PosCard>

        <PosCard title="Top staff" className="xl:col-span-2">
          <TopStaff staff={data.topStaff} />
        </PosCard>

        <PosCard title="Repeat customers">
          <RepeatGauge repeat={data.repeat} />
        </PosCard>

        <PosCard title="Top services" className="xl:col-span-2">
          <TopServices services={data.topServices} />
        </PosCard>

        <div className="space-y-4">
          <PosCard title="Payment methods">
            <PaymentMethods payments={data.payments} />
          </PosCard>
          <PosCard title="Today's appointments" actions={<CalendarCheck aria-hidden className="h-5 w-5 text-pos-accent" />}>
            <TodaysAppointments appointments={data.appointments} />
          </PosCard>
        </div>
      </div>
    </main>
  );
}
