import * as React from "react";

import { cn } from "@/lib/utils";

// The one light section on the website (the About block): off-white paper with
// a very light speckle (`.paper-speckle` in globals.css) and dark text.
export function PaperSection({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn("paper-speckle text-site-text-paper", className)}
      {...props}
    />
  );
}
