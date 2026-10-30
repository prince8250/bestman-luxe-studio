import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return (
    <PlaceholderPage
      title="Staff"
      permission="catalog.edit"
      description="Add, edit, and archive staff (spec 05); hours and time off (spec 30)."
    />
  );
}
