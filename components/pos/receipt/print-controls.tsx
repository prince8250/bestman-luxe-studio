"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";

import { choosePaperAction, recordReceiptPrintAction } from "@/app/pos/receipts/[saleId]/actions";
import { PosButton } from "@/components/brand-pos/pos-button";
import type { Paper } from "@/lib/receipt/receipt";
import { cn } from "@/lib/utils";
import { requestErrorMessage } from "@/lib/actions/request-error";

interface PrintControlsProps {
  saleId: string;
  receiptNo: string;
  prints: number;
  paper: Paper;
  autoPrint: boolean;
  /** Where "back" goes: New sale, or the sale this receipt was opened from. */
  back: { href: string; label: string };
}

const PAGE_STYLE_ID = "receipt-page-size";

// Waits for the logo and the fonts, so the printout is never missing them.
async function whenReadyToPrint() {
  await document.fonts?.ready;
  const pending = Array.from(document.images).filter((image) => !image.complete);
  await Promise.all(
    pending.map(
      (image) =>
        new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
}

// The printed page size. On the 80mm roll each copy is one page exactly as
// tall as the receipt, so the printer cuts after each copy and feeds no blank
// paper. On A4 the copies sit side by side with dashed cut lines.
function setPageSize(paper: Paper) {
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  if (paper === "a4") {
    style.textContent = "@page { size: A4; margin: 10mm; }";
    return;
  }
  const sheets = Array.from(document.querySelectorAll<HTMLElement>(".receipt-sheet"));
  const tallest = Math.max(0, ...sheets.map((sheet) => sheet.offsetHeight));
  const heightMm = Math.ceil((tallest * 25.4) / 96) + 2;
  style.textContent = `@page { size: 80mm ${heightMm}mm; margin: 0; }`;
}

// The bar above the receipt (never printed): print, reprint, and which paper
// this device prints on. With autoPrint (after a sale) it prints right away.
export function PrintControls({ saleId, receiptNo, prints, paper, autoPrint, back }: PrintControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const started = React.useRef(false);
  // The chosen paper shows at once; the receipt re-lays out when the server answers.
  const [shownPaper, setShownPaper] = React.useOptimistic(paper);
  const [changingPaper, startPaperChange] = React.useTransition();

  const print = React.useCallback(async () => {
    await whenReadyToPrint();
    setBusy(true);
    setError(null);
    try {
      setPageSize(paper);
      // Record first, so a second print is always marked REPRINT. If the
      // internet is down, print anyway: the customer is waiting.
      const result = await recordReceiptPrintAction(saleId).catch(() => null);
      if (result && !result.ok) setError(result.error);
      window.print();
    } finally {
      setBusy(false);
      // Only after printing: the page then shows REPRINT for the next print.
      // Dropping ?print=1 means reloading the page does not print again.
      if (autoPrint) router.replace(pathname, { scroll: false });
      else router.refresh();
    }
  }, [autoPrint, paper, pathname, router, saleId]);

  React.useEffect(() => {
    let cancelled = false;
    void whenReadyToPrint().then(() => {
      if (!cancelled) setPageSize(paper);
    });
    return () => {
      cancelled = true;
    };
  }, [paper]);

  React.useEffect(() => () => document.getElementById(PAGE_STYLE_ID)?.remove(), []);

  React.useEffect(() => {
    if (!autoPrint || started.current) return;
    started.current = true;
    void print();
  }, [autoPrint, print]);

  function choosePaper(next: Paper) {
    setError(null);
    startPaperChange(async () => {
      setShownPaper(next);
      try {
        const result = await choosePaperAction(next);
        if (!result.ok) setError(result.error);
      } catch (error) {
        setError(requestErrorMessage(error));
      }
    });
  }

  return (
    <div className="sticky top-0 z-10 border-b border-pos-border bg-pos-surface print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 p-3">
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="display-type truncate text-2xl leading-none">Receipt {receiptNo}</h1>
          <p className="text-xs text-pos-text-muted">
            {prints === 0
              ? "Not printed yet"
              : prints === 1
                ? "Printed once. Printing again marks it REPRINT."
                : `Printed ${prints} times. Printing again marks it REPRINT.`}
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <div role="radiogroup" aria-label="Paper" className="flex rounded-[10px] border border-pos-border p-0.5">
            {(["80mm", "a4"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={shownPaper === option}
                disabled={changingPaper}
                onClick={() => choosePaper(option)}
                className={cn(
                  "min-h-10 rounded-[8px] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
                  shownPaper === option ? "bg-pos-text text-pos-surface" : "hover:bg-pos-subtle",
                )}
              >
                {option === "80mm" ? "80mm roll" : "A4 paper"}
              </button>
            ))}
          </div>
          <PosButton onClick={() => void print()} disabled={busy || changingPaper}>
            <Printer /> {busy ? "Printing…" : prints === 0 ? "Print" : "Reprint"}
          </PosButton>
        </div>
      </div>
      {error && (
        <p role="alert" className="mx-auto max-w-3xl px-3 pb-3 text-sm text-pos-down">
          {error}
        </p>
      )}
    </div>
  );
}
