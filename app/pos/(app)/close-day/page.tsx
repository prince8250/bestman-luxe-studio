import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Close day" };

export default function CloseDayPage() {
  return (
    <PlaceholderPage
      title="Close day"
      permission="day.close"
      description="Count the cash, close the day, and print the close slip (spec 17)."
    />
  );
}
