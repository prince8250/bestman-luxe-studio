import * as React from "react";

import { cn } from "@/lib/utils";

// Page-width wrapper for the website: phone padding first, wider on desktop.
export function Container({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-7xl px-5 sm:px-8", className)} {...props} />;
}
