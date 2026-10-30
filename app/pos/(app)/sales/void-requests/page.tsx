import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { PageHeader } from "@/components/brand-pos/page-header";
import { PosCard } from "@/components/brand-pos/pos-card";
import { OwnerOnly } from "@/components/pos/owner-only";
import { Badge } from "@/components/pos/sales/sale-badges";
import { DecideRequestButtons } from "@/components/pos/sales/void-controls";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { formatGhs } from "@/lib/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatAccraDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Void requests" };

const SELECT = `id, status, reason, created_at, decided_at, decision_note,
  sale:sales!void_requests_sale_id_fkey(id, receipt_no, total, paid_at, status),
  requester:profiles!void_requests_requested_by_fkey(display_name),
  decider:profiles!void_requests_decided_by_fkey(display_name)`;

const DECIDED_LABEL = { approved: "Approved", rejected: "Rejected", cancelled: "Withdrawn" } as const;

// Owner: counter users' void requests (spec 10). Pending ones first, with
// Approve (voids the sale with the request's reason) and Reject (note
// required); then the last decisions for reference.
export default async function VoidRequestsPage() {
  const { allowed } = await pageAccess("sale.decideVoid");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const [pending, decided] = await Promise.all([
    supabase.from("void_requests").select(SELECT).eq("status", "pending").order("created_at"),
    supabase.from("void_requests").select(SELECT).neq("status", "pending").order("decided_at", { ascending: false }).limit(20),
  ]);
  if (pending.error || decided.error) throw new Error(`void_requests failed: ${(pending.error ?? decided.error)?.message}`);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-8">
      <Link
        href="/pos/sales"
        className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] pr-3 text-sm font-medium text-pos-text-muted hover:text-pos-text focus-visible:outline-2 focus-visible:outline-pos-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Sales
      </Link>
      <PageHeader title="Void requests" description="Counter users ask; you decide. Approving voids the sale with their reason." />

      <section aria-label="Waiting for you" className="space-y-3">
        {pending.data.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-8 text-center">
            <CheckCircle2 aria-hidden className="mx-auto h-7 w-7 text-pos-up" />
            <p className="mt-3 font-medium">No void requests waiting</p>
          </div>
        ) : (
          pending.data.map((request) => (
            <article key={request.id} className="rounded-[16px] border border-pos-warning/40 bg-pos-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="text-sm">
                  <p>
                    <Link href={`/pos/sales/${request.sale?.id}`} className="font-medium text-pos-accent underline-offset-4 hover:underline">
                      {request.sale?.receipt_no}
                    </Link>{" "}
                    <span className="text-pos-text-muted">
                      · {request.sale ? formatGhs(request.sale.total) : ""} · sold {request.sale ? formatAccraDateTime(request.sale.paid_at) : ""}
                    </span>
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">{request.requester?.display_name ?? "A counter user"}</span>
                    <span className="text-pos-text-muted">, {formatAccraDateTime(request.created_at)}</span>
                  </p>
                  <p className="mt-0.5">Reason: {request.reason}</p>
                </div>
                <Badge tone="warning">Void requested</Badge>
              </div>
              <div className="mt-3">
                <DecideRequestButtons requestId={request.id} receiptNo={request.sale?.receipt_no ?? "this sale"} reason={request.reason} />
              </div>
            </article>
          ))
        )}
      </section>

      {decided.data.length > 0 && (
        <PosCard title="Recently decided" className="mt-6">
          <ul className="divide-y divide-pos-border text-sm">
            {decided.data.map((request) => (
              <li key={request.id} className="py-3 first:pt-0 last:pb-0">
                <p>
                  <Link href={`/pos/sales/${request.sale?.id}`} className="font-medium text-pos-accent underline-offset-4 hover:underline">
                    {request.sale?.receipt_no}
                  </Link>{" "}
                  <span className="font-medium">{DECIDED_LABEL[request.status as keyof typeof DECIDED_LABEL] ?? request.status}</span>
                  <span className="text-pos-text-muted">
                    {" "}
                    · {request.decided_at ? formatAccraDateTime(request.decided_at) : ""}
                    {request.decider?.display_name && request.status !== "cancelled" ? ` by ${request.decider.display_name}` : ""}
                  </span>
                </p>
                <p className="text-pos-text-muted">
                  Asked by {request.requester?.display_name ?? "?"}: {request.reason}
                  {request.decision_note ? ` · Note: ${request.decision_note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </PosCard>
      )}
    </main>
  );
}
