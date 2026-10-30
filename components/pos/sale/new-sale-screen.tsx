"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { PosRole } from "@/lib/auth/types";
import type { SaleCatalog } from "@/lib/sale/catalog";

import { NewSale } from "./new-sale";

interface NewSaleScreenProps {
  catalog: SaleCatalog;
  userId: string;
  role: PosRole;
  maxCounterDiscountPercent: number;
  dayClosed: boolean;
}

const subscribe = () => () => {};

// The ticket is restored from this browser tab's storage, which the server
// cannot see, so the screen renders in the browser only (a skeleton first).
export function NewSaleScreen(props: NewSaleScreenProps) {
  const inBrowser = React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!inBrowser) return <NewSaleSkeleton />;
  return <NewSale {...props} />;
}

function NewSaleSkeleton() {
  return (
    <main className="grid flex-1 gap-4 p-4 md:p-6 lg:grid-cols-[3fr_2fr]" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-11 w-full bg-pos-subtle" />
        <Skeleton className="h-11 w-2/3 bg-pos-subtle" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-[16px] bg-pos-subtle" />
          ))}
        </div>
      </div>
      <Skeleton className="h-96 rounded-[16px] bg-pos-subtle" />
    </main>
  );
}
