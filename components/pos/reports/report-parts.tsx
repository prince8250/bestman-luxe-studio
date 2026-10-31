import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

// Small building blocks shared by the Reports pages (spec 16).

export interface Column {
  label: string;
  /** Right-aligned, tabular figures (amounts, counts). */
  numeric?: boolean;
  /** Hidden on a phone (secondary detail). */
  wide?: boolean;
}

// A plain report table. On a phone it scrolls sideways inside its card rather
// than squeezing the columns.
export function ReportTable({ columns, rows, empty = "Nothing in this period." }: { columns: Column[]; rows: ReactNode[][]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-pos-text-muted">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pos-border text-left text-xs tracking-wide whitespace-nowrap text-pos-text-muted uppercase">
            {columns.map((column) => (
              <th key={column.label} className={cn("pb-2 pr-3 font-medium last:pr-0", column.numeric && "text-right", column.wide && "hidden sm:table-cell")}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-pos-border align-top last:border-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={cn(
                    "py-2 pr-3 last:pr-0",
                    columns[cellIndex]?.numeric && "text-right whitespace-nowrap tabular-nums",
                    columns[cellIndex]?.wide && "hidden sm:table-cell",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Shown when the chosen dates are longer than the reports allow; the page
// shows its usual period instead (`showing`, for example "today").
export function RangeTooLong({ showing }: { showing: string }) {
  return (
    <p role="alert" className="mb-4 rounded-[10px] bg-pos-warning-soft px-3 py-2.5 text-sm text-pos-warning">
      Choose a period of at most two years. Showing {showing} instead.
    </p>
  );
}

// Previous / next period arrows (links, so the browser Back button works).
export function PeriodNav({ basePath, previous, next, label }: { basePath: string; previous: string | null; next: string | null; label: string }) {
  const arrow = "inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-pos-border bg-pos-surface focus-visible:outline-2 focus-visible:outline-pos-accent";
  return (
    <nav aria-label="Periods" className="flex items-center gap-1 print:hidden">
      {previous ? (
        <Link href={`${basePath}?${previous}`} aria-label={`Previous ${label}`} className={cn(arrow, "hover:bg-pos-subtle")}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrow, "opacity-40")}>
          <ChevronLeft className="h-5 w-5" />
        </span>
      )}
      {next ? (
        <Link href={`${basePath}?${next}`} aria-label={`Next ${label}`} className={cn(arrow, "hover:bg-pos-subtle")}>
          <ChevronRight className="h-5 w-5" />
        </Link>
      ) : (
        <span aria-hidden className={cn(arrow, "opacity-40")}>
          <ChevronRight className="h-5 w-5" />
        </span>
      )}
    </nav>
  );
}
