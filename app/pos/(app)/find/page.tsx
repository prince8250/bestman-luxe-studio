import type { Metadata } from "next";

import { PageHeader } from "@/components/brand-pos/page-header";
import { requirePosUser } from "@/lib/auth/require-pos-user";
import { classifyFindQuery } from "@/lib/pos/find";

export const metadata: Metadata = { title: "Find" };

const KIND_LABEL = {
  receipt: "Receipt number",
  booking: "Booking code",
  phone: "Phone number",
  unknown: "Not recognised",
} as const;

// Find results. The lookups are wired in specs 10 (receipts), 13 (customers
// by phone), and 36 (booking codes); until then this shows what was understood.
export default async function FindPage({ searchParams }: PageProps<"/pos/find">) {
  await requirePosUser();
  const { q } = await searchParams;
  const query = classifyFindQuery(typeof q === "string" ? q : "");

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader title="Find" />
      <div className="rounded-[16px] border border-pos-border bg-pos-surface p-6">
        {query.value ? (
          <>
            <p className="text-sm text-pos-text-muted">{KIND_LABEL[query.kind]}</p>
            <p className="mt-1 text-lg font-medium">{query.value}</p>
            <p className="mt-3 text-sm text-pos-text-muted">
              {query.kind === "unknown"
                ? "Type a receipt number (BLS-000123), a booking code (BK-7K4Q), or a phone number."
                : "Opening this from Find is not built yet."}
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
