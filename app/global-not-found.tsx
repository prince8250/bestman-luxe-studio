import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";
import { fontVariables } from "@/lib/fonts";

// With two root layouts (website and POS) there is no single layout to build a
// 404 from, so unmatched URLs get this standalone page in the website style.
export const metadata: Metadata = {
  title: "Page not found · Bestman Luxe Studio",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`site ${fontVariables}`}>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-site-bg p-8 text-center text-site-text">
        <p className="display-type text-7xl">404</p>
        <p className="text-site-text-muted">This page does not exist.</p>
        <Link
          href="/"
          className="display-type inline-flex min-h-11 items-center border-2 border-site-border-button bg-site-button px-6 text-xl tracking-[0.08em] transition-colors duration-200 hover:border-site-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-border-strong"
        >
          Back to the studio
        </Link>
      </body>
    </html>
  );
}
