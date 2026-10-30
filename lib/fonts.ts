import { Bebas_Neue, Inter } from "next/font/google";

// Both systems use the same two fonts (ui-context.md, "Fonts"):
// Bebas Neue for display (titles, numbers, buttons), Inter for everything people read or type.
// next/font self-hosts them and generates size-matched fallbacks, so there is no layout shift.
export const displayFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const textFont = Inter({
  subsets: ["latin"],
  variable: "--font-text",
  display: "swap",
});

export const fontVariables = `${displayFont.variable} ${textFont.variable}`;
