"use client";

import { RotateCcw } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";

// Shown when a POS page fails to load (for example the internet dropped).
// The details go to the server log, never to the screen.
export default function PosError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <div role="alert" className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <h1 className="display-type text-3xl">Could not load this page</h1>
        <p className="mt-2 text-sm text-pos-text-muted">
          Check the internet connection, then try again. Nothing you saved is lost.
        </p>
        <PosButton className="mt-5" onClick={reset}>
          <RotateCcw /> Try again
        </PosButton>
      </div>
    </main>
  );
}
