"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";

// The bar above the paper sales sheet (never printed).
export function PaperSheetControls() {
  return (
    <div className="sticky top-0 z-10 border-b border-pos-border bg-pos-surface print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 p-3">
        <Link
          href="/pos/sale/new"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <ArrowLeft className="h-4 w-4" /> New sale
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="display-type text-2xl leading-none">Paper sales sheet</h1>
          <p className="text-xs text-pos-text-muted">Print a few on A4 and keep them at the counter for when the POS is down.</p>
        </div>
        <PosButton onClick={() => window.print()}>
          <Printer /> Print
        </PosButton>
      </div>
    </div>
  );
}
