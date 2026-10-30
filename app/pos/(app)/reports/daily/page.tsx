import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Daily report" };

export default function DailyReportPage() {
  return (
    <PlaceholderPage
      title="Daily report"
      permission="reports.view"
      description="The end-of-day report (spec 16)."
    />
  );
}
