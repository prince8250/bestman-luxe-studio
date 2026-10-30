import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <PlaceholderPage
      title="Dashboard"
      permission="dashboard.view"
      description="Revenue, services done, customers, bookings, and charts for any period (spec 15)."
    />
  );
}
