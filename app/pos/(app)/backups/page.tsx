import type { Metadata } from "next";

import { PlaceholderPage } from "@/components/pos/placeholder-page";

export const metadata: Metadata = { title: "Backups" };

export default function BackupsPage() {
  return (
    <PlaceholderPage
      title="Backups"
      permission="backups.view"
      description="Backup status and downloads (specs 20 to 22)."
    />
  );
}
