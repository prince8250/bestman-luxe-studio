import * as React from "react";

import { cn } from "@/lib/utils";

interface PosCardProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  /** Card title, shown in Bebas Neue. */
  title?: React.ReactNode;
  /** Small controls at the top right (for example a menu or a link). */
  actions?: React.ReactNode;
}

// POS card: white, 16px radius, hairline border, generous padding, no heavy shadow.
export function PosCard({ title, actions, className, children, ...props }: PosCardProps) {
  return (
    <section
      className={cn("rounded-[16px] border border-pos-border bg-pos-surface p-5 md:p-6", className)}
      {...props}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="display-type text-2xl">{title}</h2>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
