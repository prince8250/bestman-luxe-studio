import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { PageHeader } from "@/components/brand-pos/page-header";
import { PosCard } from "@/components/brand-pos/pos-card";
import { OwnerOnly } from "@/components/pos/owner-only";
import { AutoSelect } from "@/components/pos/reports/auto-select";
import { DownloadButton } from "@/components/pos/reports/download-button";
import { RangePicker } from "@/components/pos/reports/range-picker";
import { RangeTooLong } from "@/components/pos/reports/report-parts";
import { Badge } from "@/components/pos/sales/sale-badges";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { firstParam } from "@/lib/params";
import { CHANGE_TYPES, changeLink, describeChange, isChangeType } from "@/lib/reports/changes";
import { isCalendarDate, isRangeTooLong, rangeFor, type RangePreset } from "@/lib/reports/range";
import { changesCsv } from "@/lib/reports/report-csv";
import { reportChanges } from "@/lib/reports/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, formatAccraDateTime, formatBusinessDate } from "@/lib/time";

export const metadata: Metadata = { title: "Change log" };

const PRESETS = ["today", "yesterday", "week", "month", "30d", "custom"] as const satisfies readonly RangePreset[];
const ROLE = { owner: "Owner", counter: "Counter" } as Record<string, string>;

function typeLabel(action: string): string | null {
  return Object.values(CHANGE_TYPES).find((type) => (type.actions as readonly string[]).includes(action))?.label ?? null;
}

// The change log (spec 16): every audit_log row for the range, newest first,
// with who made it. Filters by type of change and by account, all in the URL.
export default async function ChangeLogPage({ searchParams }: PageProps<"/pos/reports/changes">) {
  const { allowed } = await pageAccess("reports.view");
  if (!allowed) return <OwnerOnly />;

  const params = await searchParams;
  const preset = (PRESETS as readonly string[]).includes(firstParam(params.range)) ? (firstParam(params.range) as RangePreset) : "week";
  const from = isCalendarDate(firstParam(params.from)) ? firstParam(params.from) : "";
  const to = isCalendarDate(firstParam(params.to)) ? firstParam(params.to) : "";
  const today = accraDate();
  const requested = rangeFor(preset, today, from, to);
  const tooLong = isRangeTooLong(requested);
  const range = tooLong ? rangeFor("week", today) : requested;
  const type = isChangeType(firstParam(params.type)) ? firstParam(params.type) : "";
  const byParam = z.uuid().safeParse(firstParam(params.by)).success ? firstParam(params.by) : "";

  const supabase = await createSupabaseServerClient();
  const accounts = await supabase.from("profiles").select("id, display_name, role, active").order("display_name");
  const by = accounts.data?.some((account) => account.id === byParam) ? byParam : "";
  const changes = await reportChanges(supabase, range, {
    actions: isChangeType(type) ? [...CHANGE_TYPES[type].actions] : undefined,
    actorId: by || null,
  });
  const periodText = range.from === range.to ? formatBusinessDate(range.from) : `${formatBusinessDate(range.from)} to ${formatBusinessDate(range.to)}`;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8 print:p-0">
      <PageHeader
        title="Change log"
        description={periodText}
        actions={
          <>
            <RangePicker
              key={`${type}|${by}|${preset}|${requested.from}|${requested.to}`}
              action="/pos/reports/changes"
              presets={PRESETS}
              range={preset}
              from={requested.from}
              to={requested.to}
            >
              <AutoSelect
                name="type"
                label="Type of change"
                value={type}
                options={[{ value: "", label: "All changes" }, ...Object.entries(CHANGE_TYPES).map(([value, { label }]) => ({ value, label }))]}
              />
              <AutoSelect
                name="by"
                label="Made by"
                value={by}
                options={[
                  { value: "", label: "Everyone" },
                  ...(accounts.data ?? []).map((account) => ({
                    value: account.id,
                    label: `${account.display_name} (${ROLE[account.role] ?? account.role}${account.active ? "" : ", inactive"})`,
                  })),
                ]}
              />
            </RangePicker>
            <DownloadButton content={changesCsv(changes.rows, range)} filename={`changes-${range.from}-to-${range.to}.csv`} type="text/csv;charset=utf-8" label="CSV" />
          </>
        }
      />
      {tooLong && <RangeTooLong showing="this week" />}

      <PosCard
        title={changes.count === 1 ? "1 change" : `${changes.count} changes`}
        actions={changes.count > changes.rows.length ? <span className="text-sm text-pos-text-muted">Showing the newest {changes.rows.length}</span> : null}
      >
        {changes.rows.length === 0 ? (
          <p className="text-sm text-pos-text-muted">No changes in this period{type || by ? " for these filters" : ""}.</p>
        ) : (
          <ol className="divide-y divide-pos-border">
            {changes.rows.map((row) => {
              const href = changeLink(row);
              const label = typeLabel(row.action);
              return (
                <li key={row.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{describeChange(row)}</p>
                    <p className="mt-0.5 text-sm text-pos-text-muted">
                      {row.actor_name ?? "System"}
                      {ROLE[row.actor_role] ? ` (${ROLE[row.actor_role]})` : ""} · {formatAccraDateTime(row.created_at)}
                    </p>
                    {row.reason && <p className="mt-1 text-sm break-words">Reason: {row.reason}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {label && <Badge tone="muted">{label}</Badge>}
                    {href && (
                      <Link
                        href={href}
                        className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-pos-accent underline-offset-4 hover:underline"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </PosCard>
    </main>
  );
}
