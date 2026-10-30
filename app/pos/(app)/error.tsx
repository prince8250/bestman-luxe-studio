"use client";

import { RotateCcw } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";

// Shown when a POS page fails to load (for example the internet dropped).
// The details go to the server log, never to the screen. "Try again" uses
// retry(), which fetches the page's server data again (reset() would only
// re-render what already failed).
export default function PosError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <div role="alert" className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <h1 className="display-type text-3xl">Could not load this page</h1>
        <p className="mt-2 text-sm text-pos-text-muted">
          Check the internet connection, then try again. Nothing you saved is lost.
        </p>
        <PosButton className="mt-5" onClick={() => retry()}>
          <RotateCcw /> Try again
        </PosButton>
      </div>
    </main>
  );
}
