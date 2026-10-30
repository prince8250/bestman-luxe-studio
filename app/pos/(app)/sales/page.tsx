import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";

import { KpiTile } from "@/components/brand-pos/kpi-tile";
import { PageHeader } from "@/components/brand-pos/page-header";
import { PosButton } from "@/components/brand-pos/pos-button";
import { OwnerOnly } from "@/components/pos/owner-only";
import { SalesFilters } from "@/components/pos/sales/sales-filters";
import { SalesTable } from "@/components/pos/sales/sales-table";
import { can } from "@/lib/auth/permissions";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { formatGhs } from "@/lib/money";
import { METHOD_LABEL, METHODS, PAGE_SIZE, parseSalesQuery, parseSearchResult, salesHref } from "@/lib/sales/history";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, accraDayStart, addDays, formatBusinessDate } from "@/lib/time";

export const metadata: Metadata = { title: "Sales" };

// Sales history (spec 10). The owner sees every sale with filters and the
// totals for the filtered range; the counter sees today's sales only, with no
// money figures. public.search_sales applies both rules in the database.
export default async function SalesPage({ searchParams }: PageProps<"/pos/sales">) {
  const { user, allowed } = await pageAccess("sales.viewToday");
  if (!allowed) return <OwnerOnly />;
  const owner = can(user.role, "sales.viewAll");

  const today = accraDate();
  const query = parseSalesQuery(await searchParams, today);
  const supabase = await createSupabaseServerClient();
  const dates = query.dates;
  const [search, staff, accounts, pending, voidedElsewhere] = await Promise.all([
    supabase.rpc("search_sales", { p_filters: query.filters }),
    owner ? supabase.from("staff").select("id, name, archived_at").order("name") : null,
    owner ? supabase.from("profiles").select("id, display_name").order("display_name") : null,
    owner ? supabase.from("void_requests").select("id", { count: "exact", head: true }).eq("status", "pending") : null,
    // A sale counts on the day it was sold, so a void of an older sale does
    // not appear in this range's list. Name those voids so they are not missed.
    owner && dates
      ? supabase
          .from("sales")
          .select("id, receipt_no, business_date")
          .eq("status", "voided")
          .gte("voided_at", accraDayStart(dates.from).toISOString())
          .lt("voided_at", accraDayStart(addDays(dates.to, 1)).toISOString())
          .or(`business_date.lt.${dates.from},business_date.gt.${dates.to}`)
          .order("voided_at", { ascending: false })
          .limit(10)
      : null,
  ]);
  if (search.error) throw new Error(`search_sales failed: ${search.error.message}`);
  const result = parseSearchResult(search.data);
  const pendingCount = pending?.count ?? 0;
  const otherDayVoids = voidedElsewhere?.data ?? [];

  const oneDay = dates !== null && dates.from === dates.to;
  const description = !owner
    ? "Today's sales. For an older receipt, ask the owner."
    : query.values.q && !query.searchError
      ? `Searching all dates for "${query.values.q}"`
      : dates && (oneDay ? formatBusinessDate(dates.from) : `${formatBusinessDate(dates.from)} to ${formatBusinessDate(dates.to)}`);

  const first = result.count === 0 ? 0 : (query.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(query.page * PAGE_SIZE, result.count);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader
        title={owner ? "Sales" : "Sales today"}
        description={description}
        actions={
          owner && (
            <PosButton asChild variant="secondary">
              <Link href="/pos/sales/void-requests">
                Void requests
                {pendingCount > 0 && (
                  <span className="rounded-full bg-pos-warning px-2 py-0.5 text-xs font-semibold text-white tabular-nums">{pendingCount}</span>
                )}
              </Link>
            </PosButton>
          )
        }
      />

      <SalesFilters
        key={JSON.stringify(query.values)}
        values={query.values}
        full={owner}
        staff={(staff?.data ?? []).map((member) => ({ id: member.id, name: member.archived_at ? `${member.name} (removed)` : member.name }))}
        accounts={(accounts?.data ?? []).map((account) => ({ id: account.id, name: account.display_name }))}
      />
      {query.searchError && (
        <p role="alert" className="mb-4 rounded-[10px] bg-pos-warning-soft px-3 py-2.5 text-sm text-pos-warning">
          {query.searchError} Showing the date range instead.
        </p>
      )}

      {otherDayVoids.length > 0 && (
        <section aria-label="Voids of sales from other days" className="mb-4 rounded-[16px] border border-pos-down/30 bg-pos-down-soft p-4 text-sm">
          <p className="font-medium text-pos-down">
            {oneDay && dates?.from === today ? "Voided today" : "Voided in this period"}, sold on another day
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {otherDayVoids.map((sale) => (
              <li key={sale.id}>
                <Link href={`/pos/sales/${sale.id}`} className="font-medium text-pos-accent underline-offset-4 hover:underline">
                  {sale.receipt_no}
                </Link>{" "}
                <span className="text-pos-text-muted">sold {formatBusinessDate(sale.business_date)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-pos-text-muted">They count on the day they were sold, so they are not in this list or these totals.</p>
        </section>
      )}

      {result.totals && (
        <section aria-label="Totals" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile label="Revenue" value={formatGhs(result.totals.revenue)} caption={result.totals.discounts > 0 ? `After ${formatGhs(result.totals.discounts)} in discounts` : "Paid sales only"} />
          <KpiTile label="Sales" value={result.totals.sales} caption={result.count > PAGE_SIZE ? `Totals cover all ${result.count} matching sales` : "Not counting voided sales"} />
          <KpiTile label="Voided" value={result.totals.voided} caption={result.totals.voided > 0 ? `${formatGhs(result.totals.voided_amount)}, not counted` : "None"} />
          <div className="rounded-[16px] border border-pos-border bg-pos-surface p-5">
            <p className="text-sm font-medium">Payments</p>
            <dl className="mt-2 space-y-1 text-sm">
              {METHODS.filter((method) => result.totals?.by_method[method]).map((method) => (
                <div key={method} className="flex justify-between gap-2">
                  <dt className="text-pos-text-muted">{METHOD_LABEL[method]}</dt>
                  <dd className="tabular-nums">{formatGhs(result.totals?.by_method[method] ?? 0)}</dd>
                </div>
              ))}
              {Object.keys(result.totals.by_method).length === 0 && <p className="text-pos-text-muted">No payments</p>}
            </dl>
          </div>
        </section>
      )}

      {result.rows.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-10 text-center">
          <Inbox aria-hidden className="mx-auto h-7 w-7 text-pos-text-muted" />
          <p className="mt-3 font-medium">{owner ? "No sales match these filters" : "No sales yet today"}</p>
          <p className="mt-1 text-sm text-pos-text-muted">
            {owner ? "Try another date range, or clear the filters." : "Sales appear here as soon as they are confirmed."}
          </p>
        </div>
      ) : (
        <SalesTable rows={result.rows} owner={owner} showDate={!oneDay} />
      )}

      {result.count > PAGE_SIZE && (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-pos-text-muted tabular-nums">
            {first}–{last} of {result.count}
          </p>
          <div className="flex gap-2">
            {query.page > 1 && (
              <PosButton asChild variant="secondary">
                <Link href={salesHref(query.values, { page: query.page - 1 })}>
                  <ChevronLeft /> Newer
                </Link>
              </PosButton>
            )}
            {last < result.count && (
              <PosButton asChild variant="secondary">
                <Link href={salesHref(query.values, { page: query.page + 1 })}>
                  Older <ChevronRight />
                </Link>
              </PosButton>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}
