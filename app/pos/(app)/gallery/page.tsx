import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Gallery" };

export default function GalleryPage() {
  return (
    <PlaceholderPage
      title="Gallery"
      permission="catalog.edit"
      description="Photos shown on the website (spec 23)."
    />
  );
}
