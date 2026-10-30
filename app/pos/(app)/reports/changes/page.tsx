import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Change log" };

export default function ChangeLogPage() {
  return (
    <PlaceholderPage
      title="Change log"
      permission="reports.view"
      description="Reassignments, edits, voids, and price changes (spec 16)."
    />
  );
}
