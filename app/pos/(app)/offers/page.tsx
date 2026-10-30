import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Offers" };

export default function OffersPage() {
  return (
    <PlaceholderPage
      title="Offers"
      permission="catalog.edit"
      description="Offers shown on the website (spec 24)."
    />
  );
}
