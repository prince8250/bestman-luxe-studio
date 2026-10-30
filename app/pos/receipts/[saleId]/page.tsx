import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { z } from "zod";

import { ReceiptCopy } from "@/components/pos/receipt/receipt-copy";
import { PrintControls } from "@/components/pos/receipt/print-controls";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { getPublicEnv } from "@/lib/env";
import { PAPER_COOKIE, parsePaper, parseReceipt, receiptCopies } from "@/lib/receipt/receipt";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Receipt" };

// The receipt for one sale (spec 09), built only from what the database
// stored. Outside the POS shell, so only the receipt prints. The New sale
// screen loads it with ?print=1 in a hidden frame to print right away.
export default async function ReceiptPage({ params, searchParams }: PageProps<"/pos/receipts/[saleId]">) {
  const { allowed } = await pageAccess("sale.reprint");
  const { saleId } = await params;
  const { print, from } = await searchParams;
  if (!allowed || !z.uuid().safeParse(saleId).success) return <ReceiptMissing />;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("receipt_data", { p_sale_id: saleId });
  if (error) {
    if (error.message === "not_found") return <ReceiptMissing />;
    throw new Error(`receipt_data failed: ${error.message}`);
  }

  const receipt = parseReceipt(data);
  const paper = parsePaper((await cookies()).get(PAPER_COOKIE)?.value);
  const copies = receiptCopies(receipt);
  const bookUrl = `${new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL).host}/book`;

  return (
    <>
      <PrintControls
        saleId={receipt.id}
        receiptNo={receipt.receipt_no}
        prints={receipt.prints}
        paper={paper}
        autoPrint={print === "1"}
        back={from === "sale" ? { href: `/pos/sales/${receipt.id}`, label: "Sale" } : { href: "/pos/sale/new", label: "New sale" }}
      />
      <main className="flex-1 overflow-x-auto p-4 md:p-8 print:overflow-visible print:p-0">
        <div className={cn("mx-auto", paper === "a4" ? "grid w-[190mm] grid-cols-2 gap-[6mm] print:w-auto" : "flex w-fit flex-col gap-6 print:block")}>
          {copies.map((copy) => (
            <div
              key={copy.key}
              className={cn(
                "receipt-sheet bg-white text-black",
                paper === "a4"
                  ? "break-inside-avoid border border-dashed border-black p-[5mm]"
                  : "w-[80mm] px-[4mm] pt-[3mm] pb-[6mm] shadow-sm print:shadow-none print:[&:not(:last-child)]:break-after-page",
              )}
            >
              <ReceiptCopy receipt={receipt} copy={copy} reprint={receipt.prints > 0} bookUrl={bookUrl} />
            </div>
          ))}
        </div>
        {paper === "a4" && <p className="mt-3 text-center text-xs text-pos-text-muted print:hidden">Cut along the dashed lines.</p>}
      </main>
    </>
  );
}

function ReceiptMissing() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <h1 className="display-type text-3xl">Receipt not found</h1>
        <p className="mt-2 text-sm text-pos-text-muted">
          The sale does not exist, or it is from an earlier day. Counter accounts can open today&apos;s receipts; the owner can open any.
        </p>
        <Link
          href="/pos/sale/new"
          className="mt-5 inline-flex min-h-11 items-center rounded-[10px] bg-pos-accent px-4 text-sm font-medium text-pos-on-accent hover:opacity-90"
        >
          Back to New sale
        </Link>
      </div>
    </main>
  );
}
