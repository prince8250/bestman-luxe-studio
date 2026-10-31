"use client";

import * as React from "react";
import Form from "next/form";
import { CalendarRange } from "lucide-react";

import { RANGE_LABEL, type RangePreset } from "@/lib/reports/range";
import { cn } from "@/lib/utils";

interface RangePickerProps {
  /** The page the form submits to (GET), for example "/pos". */
  action: string;
  presets: readonly RangePreset[];
  range: RangePreset;
  from: string;
  to: string;
  /** Other filters that belong to the same form (for example a staff choice). */
  children?: React.ReactNode;
}

const control =
  "h-11 rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base text-pos-text md:text-sm focus-visible:outline-2 focus-visible:outline-pos-accent";

// The date range for the Dashboard and Reports (ui-context.md: Today, This
// week, This month, Last 30 days, Custom). It lives in the URL, so a period
// can be refreshed, bookmarked, or shared. A preset applies at once; custom
// dates apply with Show.
export function RangePicker({ action, presets, range, from, to, children }: RangePickerProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [preset, setPreset] = React.useState(range);

  return (
    <Form ref={formRef} action={action} className="flex flex-wrap items-center gap-2">
      {children}
      <label className="relative">
        <span className="sr-only">Period</span>
        <CalendarRange aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-pos-text-muted" />
        <select
          name="range"
          value={preset}
          onChange={(event) => {
            const next = event.target.value as RangePreset;
            setPreset(next);
            if (next !== "custom") queueMicrotask(() => formRef.current?.requestSubmit());
          }}
          className={cn(control, "pl-9")}
        >
          {presets.map((option) => (
            <option key={option} value={option}>
              {RANGE_LABEL[option]}
            </option>
          ))}
        </select>
      </label>
      {preset === "custom" && (
        <>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-pos-text-muted">From</span>
            <input name="from" type="date" defaultValue={from} required className={control} />
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-pos-text-muted">To</span>
            <input name="to" type="date" defaultValue={to} required className={control} />
          </label>
          <button type="submit" className={cn(control, "font-medium hover:bg-pos-subtle")}>
            Show
          </button>
        </>
      )}
    </Form>
  );
}
