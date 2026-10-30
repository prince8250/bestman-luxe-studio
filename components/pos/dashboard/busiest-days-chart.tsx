"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { formatGhs } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface WeekdayPoint {
  weekday: number;
  name: string;
  /** How many of this weekday the period has. */
  days: number;
  revenue: number;
  services: number;
}

type Metric = "revenue" | "services";

const config = { value: { label: "Value", color: "var(--pos-accent)" } } satisfies ChartConfig;
// The other days recede: a light step of the muted text color.
const OTHER_DAYS = "color-mix(in oklab, var(--pos-text-muted) 28%, var(--pos-surface))";

const show = (metric: Metric, value: number) => (metric === "revenue" ? formatGhs(value) : `${value} ${value === 1 ? "service" : "services"}`);

// Busiest days (ui-context.md): one bar per weekday, the top day in blue and
// the rest gray (emphasis, not a color per day). Revenue or services.
export function BusiestDaysChart({ points }: { points: WeekdayPoint[] }) {
  const [metric, setMetric] = React.useState<Metric>("revenue");
  const data = points.map((point) => ({ ...point, short: point.name.slice(0, 3), value: metric === "revenue" ? point.revenue : point.services }));
  const max = Math.max(0, ...data.map((point) => point.value));
  const top = max > 0 ? data.findIndex((point) => point.value === max) : -1;

  return (
    <div>
      <div role="radiogroup" aria-label="Show" className="mb-3 inline-flex rounded-[10px] border border-pos-border p-0.5">
        {(["revenue", "services"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={metric === option}
            onClick={() => setMetric(option)}
            className={cn(
              "min-h-10 rounded-[8px] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
              metric === option ? "bg-pos-text text-pos-surface" : "hover:bg-pos-subtle",
            )}
          >
            {option === "revenue" ? "Revenue" : "Services"}
          </button>
        ))}
      </div>
      <div className="relative">
        <ChartContainer config={config} className="aspect-auto h-48 w-full">
          <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 4 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--pos-border)" />
            <XAxis dataKey="short" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis hide domain={[0, "dataMax"]} />
            <ChartTooltip cursor={{ fill: "var(--pos-subtle)" }} content={<DayTooltip metric={metric} />} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
              {data.map((point, index) => (
                <Cell key={point.weekday} fill={index === top ? "var(--pos-accent)" : OTHER_DAYS} />
              ))}
              {/* Only the top day is labeled (selective direct label), on one line. */}
              <LabelList
                dataKey="value"
                content={(props) => {
                  const { x, y, width, value } = props as { x?: number; y?: number; width?: number; value?: unknown };
                  if (typeof value !== "number" || value !== max || max <= 0 || x === undefined || y === undefined) return null;
                  return (
                    <text x={x + (width ?? 0) / 2} y={y - 8} textAnchor="middle" className="fill-pos-text text-xs font-medium">
                      {show(metric, value)}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        {top === -1 && <p className="absolute inset-0 flex items-center justify-center text-sm text-pos-text-muted">No sales in these weeks yet.</p>}
      </div>
      <details className="mt-1 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] px-1 text-pos-text-muted hover:text-pos-text">
          Show as a table
        </summary>
        <table className="mt-2 w-full text-left tabular-nums">
          <thead>
            <tr className="border-b border-pos-border text-xs text-pos-text-muted">
              <th className="py-1.5 font-medium">Day</th>
              <th className="py-1.5 text-right font-medium">Revenue</th>
              <th className="py-1.5 text-right font-medium">Services</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.weekday} className="border-b border-pos-border last:border-0">
                <td className="py-1.5">
                  {point.name} <span className="text-xs text-pos-text-muted">({point.days})</span>
                </td>
                <td className="py-1.5 text-right">{formatGhs(point.revenue)}</td>
                <td className="py-1.5 text-right">{point.services}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function DayTooltip({ active, payload, metric }: { active?: boolean; payload?: { payload: WeekdayPoint & { value: number } }[]; metric: Metric }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-[10px] border border-pos-border bg-pos-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-pos-text tabular-nums">{show(metric, point.value)}</p>
      <p className="text-pos-text-muted">
        {point.name}s ({point.days} in the period)
      </p>
    </div>
  );
}
