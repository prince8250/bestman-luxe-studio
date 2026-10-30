import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { NEW_SALE_HREF } from "@/lib/pos/navigation";

// Shown instead of an owner-only page when a counter user opens it. The page
// renders this before loading any of its data.
export function OwnerOnly() {
  return (
    <main className="flex flex-1 items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <ShieldAlert aria-hidden className="mx-auto h-8 w-8 text-pos-warning" />
        <h1 className="display-type mt-3 text-3xl">This page is for the owner</h1>
        <p className="mt-2 text-sm text-pos-text-muted">
          Your account cannot open it. If you need something here, ask the owner.
        </p>
        <PosButton asChild className="mt-5">
          <Link href={NEW_SALE_HREF}>Back to New sale</Link>
        </PosButton>
      </div>
    </main>
  );
}
