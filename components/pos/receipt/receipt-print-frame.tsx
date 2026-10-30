"use client";

// Prints a receipt without leaving the page: the receipt loads in an
// off-screen frame with ?print=1, records the print, and opens the print
// dialog (spec 09). A new job (new nonce) prints again; reprints are marked
// REPRINT by the receipt page because the database counts every print.

export interface PrintJob {
  saleId: string;
  nonce: string;
}

export function newPrintJob(saleId: string): PrintJob {
  return { saleId, nonce: crypto.randomUUID() };
}

export function ReceiptPrintFrame({ job }: { job: PrintJob | null }) {
  if (!job) return null;
  return (
    <iframe
      key={job.nonce}
      src={`/pos/receipts/${job.saleId}?print=1`}
      title="Receipt printing"
      aria-hidden
      tabIndex={-1}
      className="pointer-events-none fixed top-0 -left-[10000px] h-[900px] w-[420px] border-0"
    />
  );
}
