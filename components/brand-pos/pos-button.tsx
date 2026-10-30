import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

// POS buttons (ui-context.md, "POS Shape And Layout"): 10px radius, at least
// 44px tall (48px on New sale), Inter labels so they stay readable all day.
const posButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap select-none",
    "transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pos-accent",
    "[&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-pos-accent text-pos-on-accent hover:bg-pos-accent-hover",
        secondary: "border border-pos-border bg-pos-surface text-pos-text hover:bg-pos-subtle",
        ghost: "bg-transparent text-pos-text hover:bg-pos-subtle",
        danger: "bg-pos-down text-pos-on-accent hover:bg-pos-down/90",
      },
      size: {
        md: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-5 text-base",
        icon: "h-11 w-11",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface PosButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof posButtonVariants> {
  /** Render the child element (for example a Next.js <Link>) with button styles. */
  asChild?: boolean;
}

export function PosButton({ className, variant, size, fullWidth, asChild = false, ...props }: PosButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  // A plain <button> submits its form by default; ours only submit when asked
  // (type="submit"), so a button added to a form can never submit it by accident.
  const defaultType = asChild ? {} : { type: "button" as const };
  return <Comp className={cn(posButtonVariants({ variant, size, fullWidth }), className)} {...defaultType} {...props} />;
}

export { posButtonVariants };
