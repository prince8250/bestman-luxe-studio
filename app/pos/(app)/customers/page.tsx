import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <PlaceholderPage
      title="Customers"
      permission="customers.view"
      description="Search customers by name or phone, visits, and notes (spec 13)."
    />
  );
}
