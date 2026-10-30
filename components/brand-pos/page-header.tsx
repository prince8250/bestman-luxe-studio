import * as React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  /** Buttons at the top right (for example a date range and Export). */
  actions?: React.ReactNode;
  className?: string;
}

// POS page title in Bebas Neue at the top left, actions at the top right.
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="display-type text-4xl md:text-[2.5rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-pos-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
