import type { Metadata, Viewport } from "next";

import "../globals.css";
import { fontVariables } from "@/lib/fonts";

// Root layout for the public website. It has its own <html> (separate from the
// POS) so the dark theme also reaches dialogs that render into <body>.
export const metadata: Metadata = {
  title: {
    default: "Bestman Luxe Studio",
    template: "%s · Bestman Luxe Studio",
  },
  description: "Barbering and beauty studio in Kumasi, Ghana.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`site ${fontVariables}`}>
      <body className="flex min-h-dvh flex-col bg-site-bg text-site-text">{children}</body>
    </html>
  );
}
