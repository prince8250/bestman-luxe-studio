import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "New sale" };

export default function NewSalePage() {
  return (
    <PlaceholderPage
      title="New sale"
      permission="sale.create"
      description="Pick services and staff, take payment, and print the receipt (spec 08)."
    />
  );
}
