import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Activity" };

export default function ActivityPage() {
  return (
    <PlaceholderPage
      title="Activity"
      permission="activity.view"
      description="Every sale, change, void request, close, and sign-in as it happens (spec 19)."
    />
  );
}
