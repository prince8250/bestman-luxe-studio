import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/pos/sales/sale-badges";
import type { DashboardAppointment, DashboardStaff } from "@/lib/reports/dashboard";
import type { ReportByChannel, ReportByMethod, ReportByService, ReportRepeatCustomers } from "@/lib/reports/reports";
import { formatGhs } from "@/lib/money";
import { formatAccraTime } from "@/lib/time";

const CHANNELS = {
  walk_in: { label: "Walk-in", color: "var(--pos-accent)" },
  online_booking: { label: "Online booking", color: "var(--pos-chart-3)" },
  phone_booking: { label: "Phone booking", color: "var(--pos-chart-4)" },
} as const;

const METHODS = { cash: "Cash", momo: "MoMo", card: "Card", other: "Other" } as const;

// Walk-in / Online booking / Phone booking counts with colored underline bars
// (the reference's "Customers" strip). The name and count are always written,
// so the color only supports them.
export function ChannelStrip({ channels }: { channels: ReportByChannel }) {
  const total = channels.reduce((sum, row) => sum + row.sales_count, 0);
  return (
    <div className="mt-4 grid grid-cols-3 gap-3 border-t border-pos-border pt-4">
      {channels.map((row) => {
        const channel = CHANNELS[row.channel];
        const share = total > 0 ? row.sales_count / total : 0;
        return (
          <div key={row.channel} className="min-w-0">
            <p className="display-type text-3xl tabular-nums">{row.sales_count}</p>
            <p className="truncate text-xs text-pos-text-muted">{channel.label}</p>
            <div className="mt-2 h-1.5 rounded-full bg-pos-subtle">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.max(share * 100, row.sales_count > 0 ? 4 : 0)}%`, background: channel.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Repeat customers as a meter: the share of identified customers in the
// period who had bought before. Fill and track are the same blue, two steps.
export function RepeatGauge({ repeat }: { repeat: ReportRepeatCustomers }) {
  const rate = repeat.rate ?? 0;
  const radius = 70;
  const length = Math.PI * radius;
  const arc = `M ${90 - radius} 90 A ${radius} ${radius} 0 0 1 ${90 + radius} 90`;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-full max-w-60" role="img" aria-label={repeat.rate === null ? "No identified customers" : `${Math.round(rate * 100)}% repeat customers`}>
        <path d={arc} fill="none" stroke="var(--pos-accent-soft)" strokeWidth={14} strokeLinecap="round" />
        {rate > 0 && (
          <path d={arc} fill="none" stroke="var(--pos-accent)" strokeWidth={14} strokeLinecap="round" strokeDasharray={`${rate * length} ${length}`} />
        )}
        <text x={90} y={82} textAnchor="middle" className="fill-pos-text font-display text-[34px]">
          {repeat.rate === null ? "—" : `${Math.round(rate * 100)}%`}
        </text>
      </svg>
      <p className="mt-1 text-center text-sm text-pos-text-muted">
        {repeat.identified === 0
          ? "No customers with a phone number in this period."
          : `${repeat.repeat} of ${repeat.identified} customers with a phone number had visited before.`}
      </p>
    </div>
  );
}

// Cash, MoMo, card: amount and share of the money taken (one color: it is
// one measure, not four series).
export function PaymentMethods({ payments }: { payments: ReportByMethod }) {
  const total = payments.reduce((sum, row) => sum + Math.max(row.amount, 0), 0);
  const shown = payments.filter((row) => row.method !== "other" || row.amount !== 0);
  return (
    <ul className="space-y-3">
      {shown.map((row) => {
        const share = total > 0 ? Math.max(row.amount, 0) / total : 0;
        return (
          <li key={row.method}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{METHODS[row.method]}</span>
              <span className="tabular-nums">
                {formatGhs(row.amount)} <span className="text-xs text-pos-text-muted">· {Math.round(share * 100)}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-pos-accent-soft">
              <div className="h-1.5 rounded-full bg-pos-accent" style={{ width: `${share * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TopStaff({ staff }: { staff: DashboardStaff[] }) {
  if (staff.length === 0) return <p className="text-sm text-pos-text-muted">No services done in this period yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-pos-border text-left text-xs tracking-wide text-pos-text-muted uppercase">
          <th className="pb-2 font-medium">Staff</th>
          <th className="pb-2 text-right font-medium">Services</th>
          <th className="pb-2 text-right font-medium">Revenue</th>
          <th className="hidden pb-2 pl-4 font-medium sm:table-cell">Top service</th>
        </tr>
      </thead>
      <tbody>
        {staff.map((member) => (
          <tr key={member.staffId} className="border-b border-pos-border last:border-0">
            <td className="py-2.5">
              <span className="flex items-center gap-2.5">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pos-subtle text-xs">
                  {member.photoUrl ? <Image src={member.photoUrl} alt="" fill sizes="36px" className="object-cover" /> : member.name.charAt(0)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{member.name}</span>
                  {member.title && <span className="block truncate text-xs text-pos-text-muted">{member.title}</span>}
                </span>
              </span>
            </td>
            <td className="py-2.5 text-right tabular-nums">{member.services}</td>
            <td className="py-2.5 text-right whitespace-nowrap tabular-nums">{formatGhs(member.revenue)}</td>
            <td className="hidden py-2.5 pl-4 text-pos-text-muted sm:table-cell">{member.topService ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TopServices({ services }: { services: ReportByService }) {
  if (services.length === 0) return <p className="text-sm text-pos-text-muted">No services done in this period yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-pos-border text-left text-xs tracking-wide text-pos-text-muted uppercase">
          <th className="pb-2 font-medium">Service</th>
          <th className="pb-2 text-right font-medium">Times</th>
          <th className="pb-2 text-right font-medium">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {services.map((service) => (
          <tr key={service.service_id ?? service.name} className="border-b border-pos-border last:border-0">
            <td className="py-2.5">
              <span className="block font-medium">{service.name}</span>
              {service.category && <span className="block text-xs text-pos-text-muted">{service.category}</span>}
            </td>
            <td className="py-2.5 text-right tabular-nums">{service.times}</td>
            <td className="py-2.5 text-right whitespace-nowrap tabular-nums">{formatGhs(service.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Today's bookings (read-only until Appointments, spec 36, adds Start sale).
export function TodaysAppointments({ appointments }: { appointments: DashboardAppointment[] }) {
  if (appointments.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-pos-text-muted">
        <CalendarDays aria-hidden className="mx-auto mb-2 h-6 w-6" />
        No more appointments today.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-pos-border">
      {appointments.map((appointment) => (
        <li key={appointment.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span className="flex min-w-0 items-center gap-3">
            <span className="display-type w-12 shrink-0 text-xl tabular-nums">{formatAccraTime(appointment.startsAt)}</span>
            <span className="min-w-0">
              <span className="block truncate font-medium">{appointment.customerName}</span>
              <span className="block truncate text-xs text-pos-text-muted">
                {appointment.serviceName ?? "Service"} · {appointment.staffName ?? "staff"}
              </span>
            </span>
          </span>
          {appointment.status === "arrived" && <Badge tone="accent">Arrived</Badge>}
        </li>
      ))}
      <li className="pt-2.5">
        <Link href="/pos/appointments" className="text-sm font-medium text-pos-accent underline-offset-4 hover:underline">
          All appointments
        </Link>
      </li>
    </ul>
  );
}
