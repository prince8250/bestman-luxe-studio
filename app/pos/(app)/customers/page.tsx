import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";

import { PageHeader } from "@/components/brand-pos/page-header";
import { PosButton } from "@/components/brand-pos/pos-button";
import { OwnerOnly } from "@/components/pos/owner-only";
import { Badge } from "@/components/pos/sales/sale-badges";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { CUSTOMERS_PAGE_SIZE, customerSearch, parseCustomerSearch, type CustomerRow } from "@/lib/customers/customers";
import { formatPhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAccraDayTime } from "@/lib/time";

export const metadata: Metadata = { title: "Customers" };

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function pageHref(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/pos/customers?${query}` : "/pos/customers";
}

// Customers (spec 13): recognised by phone number. Search by part of a name or
// any common way of writing a Ghana number. Most recent visit first.
export default async function CustomersPage({ searchParams }: PageProps<"/pos/customers">) {
  const { allowed } = await pageAccess("customers.view");
  if (!allowed) return <OwnerOnly />;

  const params = await searchParams;
  const q = one(params.q).slice(0, 80);
  const page = Math.min(Math.max(Number.parseInt(one(params.page), 10) || 1, 1), 1000);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("search_customers", {
    ...customerSearch(q),
    p_limit: CUSTOMERS_PAGE_SIZE,
    p_offset: (page - 1) * CUSTOMERS_PAGE_SIZE,
  });
  if (error) throw new Error(`search_customers failed: ${error.message}`);
  const result = parseCustomerSearch(data);
  const first = result.count === 0 ? 0 : (page - 1) * CUSTOMERS_PAGE_SIZE + 1;
  const last = Math.min(page * CUSTOMERS_PAGE_SIZE, result.count);

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader title="Customers" description={q ? `${result.count} found for "${q}"` : "Most recent visit first."} />

      <Form action="/pos/customers" role="search" className="relative mb-4 max-w-xl">
        <label htmlFor="customers-q" className="sr-only">
          Search by name or phone
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-pos-text-muted" />
        <input
          id="customers-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name or phone number"
          autoComplete="off"
          className="h-11 w-full rounded-[10px] border border-pos-border bg-pos-surface pr-3 pl-9 text-base text-pos-text placeholder:text-pos-text-muted focus-visible:outline-2 focus-visible:outline-pos-accent md:text-sm"
        />
      </Form>

      {result.rows.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-10 text-center">
          <Users aria-hidden className="mx-auto h-7 w-7 text-pos-text-muted" />
          <p className="mt-3 font-medium">{q ? "No customer matches this search" : "No customers yet"}</p>
          <p className="mt-1 text-sm text-pos-text-muted">
            {q ? "Try part of the name, or the phone number in any form." : "A customer is added when a sale or booking has their phone number."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[16px] border border-pos-border bg-pos-surface md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pos-border text-left text-xs tracking-wide whitespace-nowrap text-pos-text-muted uppercase">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 text-right font-medium">Visits</th>
                  <th className="px-4 py-3 font-medium">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((customer) => (
                  <tr key={customer.id} className="border-b border-pos-border last:border-0 hover:bg-pos-subtle/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/pos/customers/${customer.id}`}
                        className="font-medium text-pos-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-pos-accent"
                      >
                        {customer.full_name ?? "No name"}
                      </Link>
                      {customer.blocked && <Badge tone="down" className="ml-2">Blocked online</Badge>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatPhone(customer.phone)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{customer.visits}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{lastVisit(customer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {result.rows.map((customer) => (
              <li key={customer.id}>
                <Link
                  href={`/pos/customers/${customer.id}`}
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-pos-border bg-pos-surface p-4 focus-visible:outline-2 focus-visible:outline-pos-accent active:bg-pos-subtle"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-pos-accent">{customer.full_name ?? "No name"}</span>
                    <span className="block text-sm text-pos-text-muted tabular-nums">{formatPhone(customer.phone)}</span>
                    {customer.blocked && <Badge tone="down" className="mt-1">Blocked online</Badge>}
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="block tabular-nums">
                      {customer.visits} {customer.visits === 1 ? "visit" : "visits"}
                    </span>
                    <span className="block text-xs text-pos-text-muted">{lastVisit(customer)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {result.count > CUSTOMERS_PAGE_SIZE && (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-pos-text-muted tabular-nums">
            {first}–{last} of {result.count}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <PosButton asChild variant="secondary">
                <Link href={pageHref(q, page - 1)}>
                  <ChevronLeft /> Previous
                </Link>
              </PosButton>
            )}
            {last < result.count && (
              <PosButton asChild variant="secondary">
                <Link href={pageHref(q, page + 1)}>
                  Next <ChevronRight />
                </Link>
              </PosButton>
            )}
          </div>
        </nav>
      )}
    </main>
  );
}

function lastVisit(customer: CustomerRow): string {
  return customer.last_visit ? formatAccraDayTime(customer.last_visit) : "No visits yet";
}
