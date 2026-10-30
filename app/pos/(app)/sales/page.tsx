import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Sales" };

export default function SalesPage() {
  return (
    <PlaceholderPage
      title="Sales"
      permission="sales.viewToday"
      description="Sales history, receipts, voids, and void requests (spec 10)."
    />
  );
}
