"use client";

import * as React from "react";
import Form from "next/form";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  CHANNEL_LABEL,
  CHANNELS,
  METHOD_LABEL,
  METHODS,
  STATUS_LABEL,
  STATUSES,
  type SalesFilterValues,
} from "@/lib/sales/history";
import { RANGE_LABEL, RANGE_PRESETS } from "@/lib/reports/range";
import { cn } from "@/lib/utils";

interface SalesFiltersProps {
  values: SalesFilterValues;
  /** Owner: every filter. Counter: search and status only (today's sales). */
  full: boolean;
  staff: { id: string; name: string }[];
  accounts: { id: string; name: string }[];
}

const control =
  "h-11 rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base text-pos-text md:text-sm focus-visible:outline-2 focus-visible:outline-pos-accent";

// The filters live in the URL (a GET form), so a filtered list can be
// refreshed, shared, or reached with the Back button. Choosing an option
// applies it at once; the search applies on Enter.
export function SalesFilters({ values, full, staff, accounts }: SalesFiltersProps) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [range, setRange] = React.useState(values.range);
  const submit = () => formRef.current?.requestSubmit();
  const active = Boolean(values.staff || values.method || values.channel || values.status || values.by || values.q || values.range !== "today");

  return (
    <Form ref={formRef} action="/pos/sales" className="mb-4 space-y-3 rounded-[16px] border border-pos-border bg-pos-surface p-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-56 flex-1">
          <label htmlFor="sales-q" className="sr-only">
            Search by receipt number or phone
          </label>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-pos-text-muted" />
          <input
            id="sales-q"
            name="q"
            type="search"
            defaultValue={values.q}
            placeholder="Receipt number or phone"
            autoComplete="off"
            className={cn(control, "w-full pl-9")}
          />
        </div>
        {full && (
          <Select name="range" label="Dates" value={range} onChange={(value) => {
            setRange(value as SalesFilterValues["range"]);
            if (value !== "custom") queueMicrotask(submit);
          }}>
            {RANGE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {RANGE_LABEL[preset]}
              </option>
            ))}
          </Select>
        )}
        {full && range === "custom" && (
          <>
            <DateInput name="from" label="From" defaultValue={values.from} />
            <DateInput name="to" label="To" defaultValue={values.to} />
            <button type="submit" className={cn(control, "font-medium hover:bg-pos-subtle")}>
              Show
            </button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        {full && (
          <>
            <Select name="staff" label="Staff" defaultValue={values.staff} onChange={submit}>
              <option value="">All staff</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
            <Select name="method" label="Payment" defaultValue={values.method} onChange={submit}>
              <option value="">All payments</option>
              {METHODS.map((method) => (
                <option key={method} value={method}>
                  {METHOD_LABEL[method]}
                </option>
              ))}
            </Select>
            <Select name="channel" label="Channel" defaultValue={values.channel} onChange={submit}>
              <option value="">All channels</option>
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_LABEL[channel]}
                </option>
              ))}
            </Select>
            <Select name="by" label="Recorded by" defaultValue={values.by} onChange={submit}>
              <option value="">Everyone</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </>
        )}
        <Select name="status" label="Status" defaultValue={values.status} onChange={submit}>
          <option value="">Any status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </Select>
        {active && (
          <Link
            href="/pos/sales"
            className="inline-flex min-h-11 items-center rounded-[10px] px-3 text-sm font-medium text-pos-accent hover:bg-pos-accent-soft focus-visible:outline-2 focus-visible:outline-pos-accent"
          >
            Clear filters
          </Link>
        )}
      </div>
    </Form>
  );
}

function Select({
  name,
  label,
  value,
  defaultValue,
  onChange,
  children,
}: {
  name: string;
  label: string;
  value?: string;
  defaultValue?: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = `sales-${name}`;
  return (
    <div className="flex min-w-36 flex-1 flex-col gap-1 sm:flex-none">
      <label htmlFor={id} className="text-xs font-medium text-pos-text-muted">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChange(event.target.value)}
        className={control}
      >
        {children}
      </select>
    </div>
  );
}

function DateInput({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  const id = `sales-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-pos-text-muted">
        {label}
      </label>
      <input id={id} name={name} type="date" defaultValue={defaultValue} className={control} />
    </div>
  );
}
