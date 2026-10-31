"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";

// The report could not load (for example the internet dropped).
export default function DayReportError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <div role="alert" className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <h1 className="display-type text-3xl">Could not load the report</h1>
        <p className="mt-2 text-sm text-pos-text-muted">Check the internet connection, then try again.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <PosButton onClick={() => retry()}>
            <RotateCcw /> Try again
          </PosButton>
          <PosButton variant="secondary" asChild>
            <Link href="/pos">Home</Link>
          </PosButton>
        </div>
      </div>
    </main>
  );
}
