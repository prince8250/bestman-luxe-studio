import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Weekly report" };

export default function WeeklyReportPage() {
  return (
    <PlaceholderPage
      title="Weekly report"
      permission="reports.view"
      description="The week, Monday to Sunday (spec 16)."
    />
  );
}
