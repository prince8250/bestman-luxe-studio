import "server-only";

import { addDays, accraDayStart } from "@/lib/time";
import { previousRange, rangeDays, type DateRange } from "@/lib/reports/range";
import {
  reportByChannel,
  reportByDay,
  reportByPaymentMethod,
  reportByService,
  reportByStaff,
  reportByWeekday,
  reportRepeatCustomers,
  reportSummary,
  type ReportByChannel,
  type ReportByDay,
  type ReportByMethod,
  type ReportByService,
  type ReportByStaff,
  type ReportByWeekday,
  type ReportRepeatCustomers,
  type ReportSummary,
} from "@/lib/reports/reports";
import { publicImageUrl } from "@/lib/storage";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Everything the owner's Dashboard shows (spec 15). Every figure comes from
// the spec 14 report functions; this only decides which periods to ask for.

export interface DashboardStaff {
  staffId: string;
  name: string;
  title: string | null;
  photoUrl: string | null;
  services: number;
  revenue: number;
  topService: string | null;
}

export interface DashboardAppointment {
  id: string;
  startsAt: string;
  customerName: string;
  serviceName: string | null;
  staffName: string | null;
  status: "confirmed" | "arrived";
}

export interface DashboardData {
  range: DateRange;
  previous: DateRange;
  summary: ReportSummary;
  onlineBookings: { current: number; previous: number };
  channels: ReportByChannel;
  /** The revenue chart: at least 7 days, so a short range still shows a trend. */
  chart: { range: DateRange; widened: boolean; current: ReportByDay; previous: ReportByDay };
  /** Busiest days: at least 4 weeks, so every weekday has data to compare. */
  busiest: { range: DateRange; widened: boolean; days: ReportByWeekday };
  repeat: ReportRepeatCustomers;
  payments: ReportByMethod;
  topStaff: DashboardStaff[];
  topServices: ReportByService;
  appointments: DashboardAppointment[];
}

const CHART_MIN_DAYS = 7;
const BUSIEST_MIN_DAYS = 28;

// A window of at least `days` days ending on the range's last day.
function atLeast(range: DateRange, days: number): { range: DateRange; widened: boolean } {
  if (rangeDays(range) >= days) return { range, widened: false };
  return { range: { from: addDays(range.to, -(days - 1)), to: range.to }, widened: true };
}

const onlineCount = (channels: ReportByChannel) => channels.find((row) => row.channel === "online_booking")?.sales_count ?? 0;

export async function loadDashboard(supabase: Supabase, range: DateRange, today: string): Promise<DashboardData> {
  const previous = previousRange(range);
  const chart = atLeast(range, CHART_MIN_DAYS);
  const busiest = atLeast(range, BUSIEST_MIN_DAYS);

  const [summary, channels, previousChannels, chartCurrent, chartPrevious, weekdays, repeat, payments, staff, services, appointments] =
    await Promise.all([
      reportSummary(supabase, range),
      reportByChannel(supabase, range),
      reportByChannel(supabase, previous),
      reportByDay(supabase, chart.range),
      reportByDay(supabase, previousRange(chart.range)),
      reportByWeekday(supabase, busiest.range),
      reportRepeatCustomers(supabase, range),
      reportByPaymentMethod(supabase, range),
      reportByStaff(supabase, range),
      reportByService(supabase, range),
      loadTodaysAppointments(supabase, today),
    ]);

  return {
    range,
    previous,
    summary,
    onlineBookings: { current: onlineCount(channels), previous: onlineCount(previousChannels) },
    channels,
    chart: { ...chart, current: chartCurrent, previous: chartPrevious },
    busiest: { ...busiest, days: weekdays },
    repeat,
    payments,
    topStaff: await withStaffDetails(supabase, staff.slice(0, 5)),
    topServices: services.filter((row) => !row.custom).slice(0, 5),
    appointments,
  };
}

// Photos and titles for the top staff (the report has names only).
async function withStaffDetails(supabase: Supabase, rows: ReportByStaff): Promise<DashboardStaff[]> {
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from("staff")
    .select("id, title, photo_path")
    .in(
      "id",
      rows.map((row) => row.staff_id),
    );
  if (error) throw new Error(`staff details failed: ${error.message}`);
  const details = new Map(data.map((member) => [member.id, member]));
  return rows.map((row) => {
    const member = details.get(row.staff_id);
    return {
      staffId: row.staff_id,
      name: row.name,
      title: member?.title ?? null,
      photoUrl: member?.photo_path ? publicImageUrl("staff", member.photo_path) : null,
      services: row.services,
      revenue: row.revenue,
      topService: row.top_service.name,
    };
  });
}

// Today's bookings still to come or in the chair. Read-only here; starting a
// sale from a booking comes with Appointments (spec 36).
async function loadTodaysAppointments(supabase: Supabase, today: string): Promise<DashboardAppointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, customer_name, status, service:services(name), staff:staff(name)")
    .gte("starts_at", accraDayStart(today).toISOString())
    .lt("starts_at", accraDayStart(addDays(today, 1)).toISOString())
    .in("status", ["confirmed", "arrived"])
    .order("starts_at")
    .limit(8);
  if (error) throw new Error(`appointments failed: ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    customerName: row.customer_name,
    serviceName: row.service?.name ?? null,
    staffName: row.staff?.name ?? null,
    status: row.status as "confirmed" | "arrived",
  }));
}
