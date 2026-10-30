import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/brand-site/container";
import { PaperSection } from "@/components/brand-site/paper-section";
import { Reveal } from "@/components/brand-site/reveal";
import { SiteButton } from "@/components/brand-site/site-button";
import { SiteHeading } from "@/components/brand-site/site-heading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// TEMPORARY (spec 01): shows every website wrapper, token, and type size.
// Remove in spec 37.
export const metadata: Metadata = {
  title: "Design check",
  robots: { index: false, follow: false },
};

const swatches = [
  { name: "--site-bg", className: "bg-site-bg" },
  { name: "--site-surface", className: "bg-site-surface" },
  { name: "--site-bar", className: "bg-site-bar" },
  { name: "--site-button", className: "bg-site-button" },
  { name: "--site-paper", className: "bg-site-paper" },
  { name: "--site-border", className: "bg-site-border" },
  { name: "--site-border-button", className: "bg-site-border-button" },
  { name: "--site-border-strong", className: "bg-site-border-strong" },
  { name: "--site-text-muted", className: "bg-site-text-muted" },
  { name: "--site-text-paper", className: "bg-site-text-paper" },
  { name: "--site-text-paper-muted", className: "bg-site-text-paper-muted" },
  { name: "--site-error", className: "bg-site-error" },
  { name: "--site-success", className: "bg-site-success" },
];

const displaySizes = [
  { label: "Hero (text-6xl → 9xl)", className: "text-6xl sm:text-7xl md:text-8xl lg:text-9xl" },
  { label: "Section (text-5xl → 7xl)", className: "text-5xl md:text-6xl lg:text-7xl" },
  { label: "Panel (text-4xl → 5xl)", className: "text-4xl md:text-5xl" },
  { label: "Small (text-2xl → 3xl)", className: "text-2xl md:text-3xl" },
  { label: "Minimum (18px)", className: "text-lg" },
];

export default function SiteDesignCheckPage() {
  return (
    <main className="flex-1 pb-24">
      {/* Hero sample */}
      <section className="relative flex min-h-[80dvh] flex-col items-center justify-center gap-6 bg-site-bg px-5 py-20 text-center">
        <Image
          src="/brand/logo-crest.png"
          alt="Bestman Luxe Studio crest"
          width={176}
          height={176}
          priority
          className="h-36 w-36 md:h-44 md:w-44"
        />
        <SiteHeading as="h1" size="hero">
          Bestman Luxe Studio
        </SiteHeading>
        <SiteButton size="lg">Book now</SiteButton>
      </section>

      <Container className="space-y-16 py-16">
        <section className="space-y-4">
          <SiteHeading size="small">Color tokens</SiteHeading>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {swatches.map((swatch) => (
              <li key={swatch.name} className="border border-site-border">
                <div className={`h-16 ${swatch.className}`} />
                <p className="p-2 font-mono text-xs text-site-text-muted">{swatch.name}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-6">
          <SiteHeading size="small">Display type (Bebas Neue)</SiteHeading>
          {displaySizes.map((size) => (
            <div key={size.label} className="space-y-1 border-b border-site-border pb-4">
              <p className="text-sm text-site-text-muted">{size.label}</p>
              <p className={`display-type ${size.className}`}>Fresh cuts, sharp lines</p>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <SiteHeading size="small">Text type (Inter)</SiteHeading>
          <p className="max-w-prose text-base">
            Body copy is Inter at 16px or larger on the website so it stays readable on a phone and
            inputs never trigger zoom on iOS. Bebas Neue is for headings, prices, and buttons only.
          </p>
          <p className="max-w-prose text-sm text-site-text-muted">
            Muted helper text, for example opening hours or a caption under a photo.
          </p>
          <p className="display-type text-3xl">GHS 120.00 · 45 min</p>
        </section>

        <section className="space-y-4">
          <SiteHeading size="small">Buttons</SiteHeading>
          <div className="flex flex-wrap items-center gap-4">
            <SiteButton>Solid</SiteButton>
            <SiteButton variant="outline">See more</SiteButton>
            <SiteButton size="lg">Book now</SiteButton>
            <SiteButton asChild variant="outline">
              <Link href="/">Link as button</Link>
            </SiteButton>
            <SiteButton disabled>Disabled</SiteButton>
          </div>
          <div className="max-w-sm">
            <SiteButton fullWidth>Full width (mobile booking bar)</SiteButton>
          </div>
        </section>

        <section className="space-y-4">
          <SiteHeading size="small">Dialog (portal keeps the site theme)</SiteHeading>
          <Dialog>
            <DialogTrigger asChild>
              <SiteButton variant="outline">Open dialog</SiteButton>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Booking details</DialogTitle>
                <DialogDescription>
                  Dialogs render into the page body, so the theme lives on the html element.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </section>

        <section className="space-y-4">
          <SiteHeading size="small">Scroll reveal (fades up once)</SiteHeading>
          <ul className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Reveal
                as="li"
                key={index}
                delay={index * 80}
                className="flex aspect-[3/4] items-end bg-site-surface p-3"
              >
                <span className="display-type text-2xl">Tile {index + 1}</span>
              </Reveal>
            ))}
          </ul>
        </section>
      </Container>

      <PaperSection className="py-16">
        <Container className="grid gap-8 md:grid-cols-2 md:items-center">
          <div className="aspect-[4/5] bg-site-text-paper-muted/20" />
          <div className="space-y-5">
            <SiteHeading>The paper section</SiteHeading>
            <div className="h-0.5 w-24 bg-site-text-paper" />
            <p className="text-lg font-semibold">The one light section on the website</p>
            <p className="text-site-text-paper-muted">
              Off-white paper with a very light speckle. Used once, for About.
            </p>
            <SiteButton variant="paper">See more</SiteButton>
          </div>
        </Container>
      </PaperSection>
    </main>
  );
}
