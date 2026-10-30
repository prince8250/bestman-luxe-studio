import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <PlaceholderPage
      title="Today"
      permission="today.view"
      description="Today's sales and appointments, without money totals (specs 10 and 36)."
    />
  );
}
