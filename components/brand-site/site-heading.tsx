import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Bebas Neue headings for the website. Sizes never go below about 18px, and the
// font is never bolded or uppercased (it is already capitals).
const siteHeadingVariants = cva("display-type text-balance", {
  variants: {
    size: {
      // The studio name in the hero.
      hero: "text-6xl sm:text-7xl md:text-8xl lg:text-9xl",
      // Section headings ("Our work", "About").
      section: "text-5xl md:text-6xl lg:text-7xl",
      // Service panel titles and page titles.
      panel: "text-4xl md:text-5xl",
      // Small headings, for example a service category.
      small: "text-2xl md:text-3xl",
    },
  },
  defaultVariants: { size: "section" },
});

type HeadingTag = "h1" | "h2" | "h3" | "p";

export interface SiteHeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof siteHeadingVariants> {
  as?: HeadingTag;
}

export function SiteHeading({ as: Tag = "h2", size, className, ...props }: SiteHeadingProps) {
  return <Tag className={cn(siteHeadingVariants({ size }), className)} {...props} />;
}
