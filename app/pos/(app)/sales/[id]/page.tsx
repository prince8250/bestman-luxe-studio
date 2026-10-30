import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Ban, CalendarClock, Receipt } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/brand-pos/page-header";
import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { OwnerOnly } from "@/components/pos/owner-only";
import { SaleBadges } from "@/components/pos/sales/sale-badges";
import {
  CancelRequestButton,
  DecideRequestButtons,
  ReprintButton,
  RequestVoidButton,
  VoidSaleButton,
} from "@/components/pos/sales/void-controls";
import { can } from "@/lib/auth/permissions";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { formatGhs } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { describeHistory } from "@/lib/sales/describe";
import { CHANNEL_LABEL, METHOD_LABEL, parseSaleDetail, type SaleDetail, type VoidRequest } from "@/lib/sales/history";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAccraDateTime, formatBusinessDate } from "@/lib/time";

export const metadata: Metadata = { title: "Sale" };

const REQUEST_STATUS = { pending: "Waiting for the owner", approved: "Approved", rejected: "Rejected", cancelled: "Withdrawn" } as const;

// One sale, exactly as stored (spec 10): times, flags, who recorded it,
// customer, lines with staff and override reasons, payments, the linked
// appointment, void requests, and (owner only) the change history.
export default async function SaleDetailPage({ params }: PageProps<"/pos/sales/[id]">) {
  const { user, allowed } = await pageAccess("sales.viewToday");
  if (!allowed) return <OwnerOnly />;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return <SaleMissing owner={user.role === "owner"} />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("sale_detail", { p_sale_id: id });
  if (error) {
    if (error.message === "not_found") return <SaleMissing owner={user.role === "owner"} />;
    throw new Error(`sale_detail failed: ${error.message}`);
  }
  const sale = parseSaleDetail(data);
  const pending = sale.void_requests.find((request) => request.status === "pending") ?? null;
  const decided = sale.void_requests.filter((request) => request.status !== "pending");
  const paid = sale.status === "paid";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8">
      <Link
        href="/pos/sales"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] pr-3 text-sm font-medium text-pos-text-muted hover:text-pos-text focus-visible:outline-2 focus-visible:outline-pos-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Sales
      </Link>
      <PageHeader
        title={`Sale ${sale.receipt_no}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            {formatAccraDateTime(sale.paid_at)}
            <SaleBadges status={sale.status} voidRequested={pending !== null} isBackdated={sale.is_backdated} afterClose={sale.after_close} />
          </span>
        }
        actions={
          <>
            {paid && can(user.role, "sale.reprint") && <ReprintButton saleId={sale.id} />}
            <PosButton asChild variant="ghost">
              <Link href={`/pos/receipts/${sale.id}?from=sale`}>
                <Receipt /> View receipt
              </Link>
            </PosButton>
            {paid && can(user.role, "sale.void") && <VoidSaleButton saleId={sale.id} receiptNo={sale.receipt_no} />}
            {paid && !pending && can(user.role, "sale.requestVoid") && <RequestVoidButton saleId={sale.id} receiptNo={sale.receipt_no} />}
          </>
        }
      />

      {sale.status === "voided" && (
        <div role="status" className="mb-4 flex gap-3 rounded-[16px] border border-pos-down/30 bg-pos-down-soft p-4 text-sm">
          <Ban aria-hidden className="h-5 w-5 shrink-0 text-pos-down" />
          <div>
            <p className="font-medium text-pos-down">
              Voided{sale.voided_by ? ` by ${sale.voided_by}` : ""}
              {sale.voided_at ? `, ${formatAccraDateTime(sale.voided_at)}` : ""}
            </p>
            {sale.void_reason && <p className="mt-0.5">Reason: {sale.void_reason}</p>}
            <p className="mt-0.5 text-pos-text-muted">It stays in the records and does not count in any total.</p>
          </div>
        </div>
      )}

      {pending && <PendingRequest request={pending} sale={sale} canDecide={can(user.role, "sale.decideVoid")} />}

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr] lg:items-start">
        <div className="space-y-4">
          <PosCard title="Services">
            <ul className="divide-y divide-pos-border">
              {sale.lines.map((line) => (
                <li key={line.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {line.name}
                      {line.custom && <span className="ml-2 rounded-md bg-pos-subtle px-1.5 py-0.5 text-xs text-pos-text-muted">Custom</span>}
                    </p>
                    <p className="text-sm text-pos-text-muted">
                      {line.staff_name ? `Done by ${line.staff_name}` : "No staff"}
                      {line.quantity > 1 && ` · ${line.quantity} × ${formatGhs(line.unit_price)}`}
                    </p>
                    {line.unit_price !== line.list_price && (
                      <p className="text-sm text-pos-text-muted">
                        Usual price {formatGhs(line.list_price)}
                        {line.reason ? ` · Reason: ${line.reason}` : ""}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">{formatGhs(line.line_total)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-pos-border pt-3 text-sm">
              {sale.discount_total > 0 && (
                <>
                  <Row label="Subtotal" value={formatGhs(sale.subtotal)} />
                  <Row label="Discount" value={`-${formatGhs(sale.discount_total)}`} />
                </>
              )}
              <div className="flex items-baseline justify-between pt-1">
                <dt className="display-type text-2xl">Total</dt>
                <dd className={`display-type text-4xl tabular-nums ${sale.status === "voided" ? "text-pos-text-muted line-through" : ""}`}>
                  {formatGhs(sale.total)}
                </dd>
              </div>
            </dl>
          </PosCard>

          <PosCard title="Payments">
            <ul className="space-y-2 text-sm">
              {sale.payments.map((payment, index) => (
                <li key={index} className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {payment.kind === "adjustment" ? (payment.amount < 0 ? "Refund" : "Extra paid") : "Paid"} by {METHOD_LABEL[payment.method]}
                    </p>
                    {payment.tendered !== null && (
                      <p className="text-pos-text-muted tabular-nums">
                        Cash given {formatGhs(payment.tendered)} · Change {formatGhs(payment.tendered - payment.amount)}
                      </p>
                    )}
                    {payment.reference && <p className="text-pos-text-muted">Reference {payment.reference}</p>}
                    {payment.kind === "adjustment" && <p className="text-pos-text-muted">{formatAccraDateTime(payment.created_at)}</p>}
                  </div>
                  <p className="shrink-0 tabular-nums">{formatGhs(Math.abs(payment.amount))}</p>
                </li>
              ))}
            </ul>
          </PosCard>

          {sale.history && (
            <PosCard title="Change history">
              {sale.history.length === 0 ? (
                <p className="text-sm text-pos-text-muted">No changes since the sale was made.</p>
              ) : (
                <ol className="space-y-3">
                  {sale.history.map((entry, index) => (
                    <li key={index} className="border-l-2 border-pos-border pl-3 text-sm">
                      <p>
                        <span className="font-medium">{entry.actor_name ?? "System"}</span>
                        <span className="text-pos-text-muted"> ({entry.actor_role})</span>: {describeHistory(entry)}
                      </p>
                      {entry.reason && <p className="text-pos-text-muted">&ldquo;{entry.reason}&rdquo;</p>}
                      <p className="text-xs text-pos-text-muted">{formatAccraDateTime(entry.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </PosCard>
          )}
        </div>

        <div className="space-y-4">
          <PosCard title="Details">
            <dl className="space-y-2 text-sm">
              <Row label="Paid" value={formatAccraDateTime(sale.paid_at)} />
              {(sale.is_backdated || sale.after_close) && <Row label="Recorded" value={formatAccraDateTime(sale.recorded_at)} />}
              <Row label="Business day" value={formatBusinessDate(sale.business_date)} />
              <Row label="Recorded by" value={sale.recorded_by ?? "—"} />
              <Row label="Channel" value={CHANNEL_LABEL[sale.channel]} />
              <Row
                label="Customer"
                value={
                  sale.customer_name || sale.customer_phone ? (
                    <>
                      {sale.customer_name ?? "No name"}
                      {sale.customer_phone && <span className="block text-pos-text-muted">{formatPhone(sale.customer_phone)}</span>}
                    </>
                  ) : (
                    "Walk-in (no phone)"
                  )
                }
              />
              <Row label="Receipt printed" value={sale.prints === 0 ? "Not yet" : sale.prints === 1 ? "Once" : `${sale.prints} times`} />
              {sale.note && <Row label="Note" value={sale.note} />}
            </dl>
          </PosCard>

          {sale.appointment && (
            <PosCard title="Appointment">
              <div className="flex gap-3 text-sm">
                <CalendarClock aria-hidden className="h-5 w-5 shrink-0 text-pos-accent" />
                <div>
                  <p className="font-medium">{sale.appointment.code}</p>
                  <p className="text-pos-text-muted">
                    {formatAccraDateTime(sale.appointment.starts_at)} · {sale.appointment.service_name ?? "Service"} with{" "}
                    {sale.appointment.staff_name ?? "staff"} · {sale.appointment.source === "web" ? "Booked online" : "Booked by phone"}
                  </p>
                </div>
              </div>
            </PosCard>
          )}

          {decided.length > 0 && (
            <PosCard title="Void requests">
              <ul className="space-y-3 text-sm">
                {decided.map((request) => (
                  <li key={request.id}>
                    <p>
                      <span className="font-medium">{REQUEST_STATUS[request.status]}</span>
                      <span className="text-pos-text-muted">
                        {" "}
                        · asked by {request.requested_by ?? "?"}, {formatAccraDateTime(request.created_at)}
                      </span>
                    </p>
                    <p className="text-pos-text-muted">Reason: {request.reason}</p>
                    {request.decided_by && request.status !== "cancelled" && (
                      <p className="text-pos-text-muted">
                        {request.decided_by}
                        {request.decision_note ? `: ${request.decision_note}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </PosCard>
          )}
        </div>
      </div>
    </main>
  );
}

function PendingRequest({ request, sale, canDecide }: { request: VoidRequest; sale: SaleDetail; canDecide: boolean }) {
  return (
    <section
      aria-label="Void request"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-pos-warning/40 bg-pos-warning-soft p-4"
    >
      <div className="text-sm">
        <p className="font-medium text-pos-warning">
          Void requested by {request.mine ? "you" : (request.requested_by ?? "a counter user")}, {formatAccraDateTime(request.created_at)}
        </p>
        <p className="mt-0.5">Reason: {request.reason}</p>
        {!canDecide && !request.mine && <p className="mt-0.5 text-pos-text-muted">Waiting for the owner.</p>}
      </div>
      {canDecide && <DecideRequestButtons requestId={request.id} receiptNo={sale.receipt_no} reason={request.reason} />}
      {!canDecide && request.mine && <CancelRequestButton requestId={request.id} />}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-pos-text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function SaleMissing({ owner }: { owner: boolean }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <h1 className="display-type text-3xl">Sale not found</h1>
        <p className="mt-2 text-sm text-pos-text-muted">
          {owner ? "No sale has this link. Search for it by receipt number." : "This is not one of today's sales. For an older receipt, ask the owner."}
        </p>
        <PosButton asChild className="mt-5">
          <Link href="/pos/sales">Back to sales</Link>
        </PosButton>
      </div>
    </main>
  );
}
