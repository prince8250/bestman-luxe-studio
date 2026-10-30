import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      permission="settings.edit"
      description="Studio details, counter controls, owner alerts, and counter accounts (spec 07)."
    />
  );
}
