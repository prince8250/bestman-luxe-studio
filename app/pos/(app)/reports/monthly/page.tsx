import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Monthly report" };

export default function MonthlyReportPage() {
  return (
    <PlaceholderPage
      title="Monthly report"
      permission="reports.view"
      description="The month (spec 16)."
    />
  );
}
