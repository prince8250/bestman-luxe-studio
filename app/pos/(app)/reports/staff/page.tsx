import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Staff report" };

export default function StaffReportPage() {
  return (
    <PlaceholderPage
      title="Staff report"
      permission="reports.view"
      description="Services and revenue per staff member (spec 16)."
    />
  );
}
