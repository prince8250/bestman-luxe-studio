import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Ban, CalendarDays, Phone, Receipt } from "lucide-react";
import { z } from "zod";

import { KpiTile } from "@/components/brand-pos/kpi-tile";
import { PageHeader } from "@/components/brand-pos/page-header";
import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { CustomerBlockButton, CustomerEditForm } from "@/components/pos/customers/customer-controls";
import { OwnerOnly } from "@/components/pos/owner-only";
import { Badge } from "@/components/pos/sales/sale-badges";
import { can } from "@/lib/auth/permissions";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { APPOINTMENT_STATUS_LABEL, parseCustomerDetail } from "@/lib/customers/customers";
import { formatGhs } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAccraDateTime, formatAccraDay, formatAccraDayTime } from "@/lib/time";

export const metadata: Metadata = { title: "Customer" };

// One customer (spec 13): visits, favourite service, usual staff, sales and
// appointments, and notes. Total spent and sale amounts are for the owner
// only; visits count paid sales only (customer_detail).
export default async function CustomerPage({ params }: PageProps<"/pos/customers/[id]">) {
  const { user, allowed } = await pageAccess("customers.view");
  if (!allowed) return <OwnerOnly />;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return <CustomerMissing />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("customer_detail", { p_customer_id: id });
  if (error) {
    if (error.message === "not_found") return <CustomerMissing />;
    throw new Error(`customer_detail failed: ${error.message}`);
  }
  const customer = parseCustomerDetail(data);
  const owner = can(user.role, "customers.block");
  const { stats } = customer;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8">
      <Link
        href="/pos/customers"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] pr-3 text-sm font-medium text-pos-text-muted hover:text-pos-text focus-visible:outline-2 focus-visible:outline-pos-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>
      <PageHeader
        title={customer.full_name ?? "No name"}
        description={
          <span className="inline-flex items-center gap-1.5 tabular-nums">
            <Phone aria-hidden className="h-4 w-4" />
            {formatPhone(customer.phone)}
          </span>
        }
        actions={owner && <CustomerBlockButton customerId={customer.id} blocked={customer.blocked} />}
      />

      {customer.blocked && (
        <div role="status" className="mb-4 flex gap-3 rounded-[16px] border border-pos-down/30 bg-pos-down-soft p-4 text-sm">
          <Ban aria-hidden className="h-5 w-5 shrink-0 text-pos-down" />
          <div>
            <p className="font-medium text-pos-down">Blocked for online booking</p>
            {customer.blocked_reason && <p className="mt-0.5">Reason: {customer.blocked_reason}</p>}
            {customer.blocked_by && (
              <p className="mt-0.5 text-pos-text-muted">
                By {customer.blocked_by.name ?? "the owner"}, {formatAccraDateTime(customer.blocked_by.at)}. They can still be served at the counter.
              </p>
            )}
          </div>
        </div>
      )}

      <section aria-label="Summary" className={`mb-4 grid grid-cols-2 gap-3 ${owner ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <KpiTile label="Visits" value={<Fit>{stats.visits}</Fit>} caption={stats.first_visit ? `Since ${formatAccraDay(stats.first_visit)}` : "No paid sales yet"} />
        <KpiTile
          label="Last visit"
          value={<Fit>{stats.last_visit ? formatAccraDay(stats.last_visit) : "—"}</Fit>}
          caption={stats.last_visit ? formatAccraDateTime(stats.last_visit) : " "}
        />
        {owner && stats.total_spent !== null && <KpiTile label="Total spent" value={<Fit>{formatGhs(stats.total_spent)}</Fit>} caption="Paid sales only" />}
        <KpiTile
          label="Favourite service"
          value={<span className="text-2xl">{customer.favorite_service?.name ?? "—"}</span>}
          caption={times(customer.favorite_service?.times)}
        />
        <KpiTile label="Usual staff" value={<span className="text-2xl">{customer.usual_staff?.name ?? "—"}</span>} caption={times(customer.usual_staff?.times)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="space-y-4">
          <PosCard title="Sales">
            {customer.sales.length === 0 ? (
              <p className="text-sm text-pos-text-muted">No sales yet.</p>
            ) : (
              <ul className="divide-y divide-pos-border">
                {customer.sales.map((sale) => (
                  <li key={sale.id} className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-1.5">
                        {sale.can_open ? (
                          <Link href={`/pos/sales/${sale.id}`} className="font-medium text-pos-accent underline-offset-4 hover:underline">
                            {sale.receipt_no}
                          </Link>
                        ) : (
                          <span className="font-medium">{sale.receipt_no}</span>
                        )}
                        <span className="text-pos-text-muted">{formatAccraDayTime(sale.paid_at)}</span>
                        {sale.status === "voided" && <Badge tone="down">Voided</Badge>}
                      </p>
                      <p className="text-pos-text-muted">
                        {sale.items.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}${item.staff_name ? ` (${item.staff_name})` : ""}`).join(", ")}
                      </p>
                    </div>
                    {sale.total !== null && (
                      <p className={`shrink-0 tabular-nums ${sale.status === "voided" ? "text-pos-text-muted line-through" : ""}`}>{formatGhs(sale.total)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!owner && customer.sales.some((sale) => !sale.can_open) && (
              <p className="mt-3 text-xs text-pos-text-muted">Older receipts open for the owner only.</p>
            )}
          </PosCard>

          <PosCard title="Appointments">
            {customer.appointments.length === 0 ? (
              <p className="text-sm text-pos-text-muted">No appointments.</p>
            ) : (
              <ul className="divide-y divide-pos-border">
                {customer.appointments.map((appointment) => (
                  <li key={appointment.id} className="flex items-start justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                    <div className="flex min-w-0 gap-2">
                      <CalendarDays aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-pos-text-muted" />
                      <div>
                        <p>
                          <span className="font-medium">{formatAccraDateTime(appointment.starts_at)}</span>{" "}
                          <span className="text-pos-text-muted">· {appointment.code}</span>
                        </p>
                        <p className="text-pos-text-muted">
                          {appointment.service_name ?? "Service"} with {appointment.staff_name ?? "staff"} ·{" "}
                          {appointment.source === "web" ? "online" : "by phone"}
                        </p>
                      </div>
                    </div>
                    <Badge tone={appointment.status === "cancelled" || appointment.status === "no_show" ? "muted" : "accent"}>
                      {APPOINTMENT_STATUS_LABEL[appointment.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </PosCard>
        </div>

        <PosCard title="Details">
          <CustomerEditForm customerId={customer.id} fullName={customer.full_name} notes={customer.notes} />
          <dl className="mt-4 space-y-2 border-t border-pos-border pt-3 text-sm">
            <Row label="Phone" value={<span className="tabular-nums">{formatPhone(customer.phone)}</span>} />
            <Row label="Customer since" value={formatAccraDayTime(customer.created_at)} />
          </dl>
          <p className="mt-3 text-xs text-pos-text-muted">The phone number is how the customer is recognised, so it cannot be changed here.</p>
          <PosButton asChild variant="ghost" className="mt-2 -ml-3">
            <Link href={`/pos/sales?q=${encodeURIComponent(customer.phone)}`}>
              <Receipt /> Sales with this number
            </Link>
          </PosButton>
        </PosCard>
      </div>
    </main>
  );
}

// Tile values on one line, a little smaller than the dashboard's (five tiles share the row).
function Fit({ children }: { children: ReactNode }) {
  return <span className="text-3xl whitespace-nowrap">{children}</span>;
}

function times(count: number | undefined): string {
  // A non-breaking space keeps the tiles the same height.
  if (!count) return " ";
  return count === 1 ? "Once" : `${count} times`;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-pos-text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function CustomerMissing() {
  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <h1 className="display-type text-3xl">Customer not found</h1>
        <p className="mt-2 text-sm text-pos-text-muted">Search for them by name or phone number.</p>
        <PosButton asChild className="mt-5">
          <Link href="/pos/customers">Back to customers</Link>
        </PosButton>
      </div>
    </main>
  );
}
