"use client";

import { Area, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatGhs } from "@/lib/money";

export interface RevenuePoint {
  date: string;
  previousDate: string | null;
  current: number;
  previous: number;
}

const config = {
  current: { label: "This period", color: "var(--pos-accent)" },
  previous: { label: "Previous period", color: "var(--pos-text-muted)" },
} satisfies ChartConfig;

const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric" });
const longDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const asDate = (value: string) => new Date(`${value}T00:00:00Z`);

// "GHS 1.2K" on the axis; exact amounts are in the tooltip and the table.
function compactGhs(pesewas: number): string {
  const ghs = pesewas / 100;
  if (ghs >= 1000) return `${Math.round(ghs / 100) / 10}K`;
  return String(Math.round(ghs));
}

// Revenue by day (ui-context.md "Mapping The Reference"): this period solid
// blue with a soft fill, the previous period of the same length dashed gray,
// day by day. One axis (both are revenue).
export function RevenueChart({ points }: { points: RevenuePoint[] }) {
  const empty = points.every((point) => point.current === 0 && point.previous === 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-pos-text-muted" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-pos-accent" /> This period
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-pos-text-muted" /> Previous period
        </span>
      </div>
      <div className="relative">
        <ChartContainer config={config} className="aspect-auto h-60 w-full">
          <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--pos-border)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={20}
              tickFormatter={(value: string) => shortDay.format(asDate(value))}
            />
            <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={compactGhs} allowDecimals={false} tick={!empty} />
            <ChartTooltip cursor={{ stroke: "var(--pos-text-muted)", strokeWidth: 1 }} content={<RevenueTooltip />} />
            <Area
              dataKey="current"
              type="monotone"
              stroke="var(--color-current)"
              strokeWidth={2}
              fill="var(--color-current)"
              fillOpacity={0.1}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--pos-surface)" }}
              isAnimationActive={false}
            />
            <Line
              dataKey="previous"
              type="monotone"
              stroke="var(--color-previous)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--pos-surface)" }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
        {empty && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-pos-text-muted">No sales in these days yet.</p>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] px-1 text-pos-text-muted hover:text-pos-text">
          Show as a table
        </summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr className="border-b border-pos-border text-xs text-pos-text-muted">
              <th className="py-1.5 font-medium">Day</th>
              <th className="py-1.5 text-right font-medium">This period</th>
              <th className="py-1.5 text-right font-medium">Previous period</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date} className="border-b border-pos-border last:border-0">
                <td className="py-1.5">{longDay.format(asDate(point.date))}</td>
                <td className="py-1.5 text-right">{formatGhs(point.current)}</td>
                <td className="py-1.5 text-right text-pos-text-muted">{formatGhs(point.previous)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

// Values lead, labels follow; each row keyed by a short line in the series style.
function RevenueTooltip({ active, payload }: { active?: boolean; payload?: { payload: RevenuePoint }[] }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="min-w-44 rounded-[10px] border border-pos-border bg-pos-surface px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-pos-text-muted">
          <span className="h-0.5 w-3 rounded bg-pos-accent" />
          {longDay.format(asDate(point.date))}
        </span>
        <span className="font-semibold text-pos-text tabular-nums">{formatGhs(point.current)}</span>
      </div>
      {point.previousDate && (
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-pos-text-muted">
            <span className="h-0 w-3 border-t-2 border-dashed border-pos-text-muted" />
            {longDay.format(asDate(point.previousDate))}
          </span>
          <span className="font-semibold text-pos-text tabular-nums">{formatGhs(point.previous)}</span>
        </div>
      )}
    </div>
  );
}
