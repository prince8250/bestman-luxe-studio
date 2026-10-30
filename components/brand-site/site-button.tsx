import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// Website buttons (ui-context.md, "Site Buttons"): square, Bebas Neue, quiet.
// Pressed state shifts down 1px; never a bounce.
const siteButtonVariants = cva(
  [
    "display-type inline-flex items-center justify-center gap-2 rounded-none whitespace-nowrap",
    "min-h-11 tracking-[0.08em] transition-colors duration-200 select-none",
    "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-border-strong",
    "[&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        solid:
          "border-2 border-site-border-button bg-site-button text-site-text hover:border-site-border-strong hover:bg-site-button-hover",
        outline:
          "border border-site-border-strong bg-transparent text-site-text hover:bg-site-text hover:text-site-bg",
        // For the light paper section: dark fill, white text.
        paper:
          "border-2 border-site-border-button bg-site-button text-site-text hover:bg-site-text-paper focus-visible:outline-site-text-paper",
      },
      size: {
        md: "px-6 text-xl",
        lg: "min-h-13 px-8 text-2xl",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "solid", size: "md" },
  },
);

export interface SiteButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof siteButtonVariants> {
  /** Render the child element (for example a Next.js <Link>) with button styles. */
  asChild?: boolean;
}

export function SiteButton({ className, variant, size, fullWidth, asChild = false, ...props }: SiteButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  // A plain <button> submits its form by default; ours only submit when asked
  // (type="submit"), so a button added to a form can never submit it by accident.
  const defaultType = asChild ? {} : { type: "button" as const };
  return <Comp className={cn(siteButtonVariants({ variant, size, fullWidth }), className)} {...defaultType} {...props} />;
}

export { siteButtonVariants };
