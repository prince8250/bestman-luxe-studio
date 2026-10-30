import type { Metadata, Viewport } from "next";

import "../globals.css";
import { fontVariables } from "@/lib/fonts";

// Root layout for the POS. Separate from the website: light theme, and never
// indexed by search engines (robots.txt also disallows /pos).
export const metadata: Metadata = {
  title: {
    default: "Bestman POS",
    template: "%s · Bestman POS",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f4f5f7",
};

export default function PosLayout({ children }: LayoutProps<"/pos">) {
  return (
    <html lang="en" className={`pos ${fontVariables}`}>
      <body className="flex min-h-dvh flex-col bg-pos-bg text-pos-text">{children}</body>
    </html>
  );
}
