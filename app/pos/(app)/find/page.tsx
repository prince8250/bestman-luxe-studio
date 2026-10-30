import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/brand-pos/page-header";
import { requirePosUser } from "@/lib/auth/require-pos-user";
import { classifyFindQuery } from "@/lib/pos/find";
import { parseSearchResult } from "@/lib/sales/history";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Find" };

const KIND_LABEL = {
  receipt: "Receipt number",
  booking: "Booking code",
  phone: "Phone number",
  unknown: "Not recognised",
} as const;

// Find results. A receipt number opens that sale directly (spec 10; a counter
// user only finds today's sales). Phone numbers and booking codes are wired in
// specs 13 and 36; until then this shows what was understood.
export default async function FindPage({ searchParams }: PageProps<"/pos/find">) {
  const user = await requirePosUser();
  const { q } = await searchParams;
  const query = classifyFindQuery(typeof q === "string" ? q : "");

  let message = "Opening this from Find is not built yet.";
  if (query.kind === "receipt") {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("search_sales", { p_filters: { receipt_no: query.value, limit: 1 } });
    if (error) throw new Error(`search_sales failed: ${error.message}`);
    const sale = parseSearchResult(data).rows[0];
    if (sale) redirect(`/pos/sales/${sale.id}`);
    message =
      user.role === "owner"
        ? "No sale has this receipt number."
        : "This receipt is not one of today's sales. For an older receipt, ask the owner.";
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader title="Find" />
      <div className="rounded-[16px] border border-pos-border bg-pos-surface p-6">
        {query.value ? (
          <>
            <p className="text-sm text-pos-text-muted">{KIND_LABEL[query.kind]}</p>
            <p className="mt-1 text-lg font-medium">{query.value}</p>
            <p className="mt-3 text-sm text-pos-text-muted">
              {query.kind === "unknown" ? "Type a receipt number (BLS-000123), a booking code (BK-7K4Q), or a phone number." : message}
            </p>
          </>
        ) : (
          <p className="text-sm text-pos-text-muted">
            Type a receipt number, booking code, or phone number in the Find box (Ctrl+K).
          </p>
        )}
      </div>
    </main>
  );
}
