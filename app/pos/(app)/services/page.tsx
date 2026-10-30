import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Services" };

export default function ServicesPage() {
  return (
    <PlaceholderPage
      title="Services"
      permission="catalog.edit"
      description="Categories, services, prices, and who does what (spec 06)."
    />
  );
}
