"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import type { DayReportPaper } from "@/lib/reports/day-report-html";
import { cn } from "@/lib/utils";

const PAGE_STYLE_ID = "day-report-page-size";

// The printed page. A4 pages break normally. On the 80mm roll the whole
// report is one page exactly as long as it is, so the printer never cuts or
// feeds blank paper in the middle of a table.
function setPageSize(paper: DayReportPaper) {
  let style = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    document.head.appendChild(style);
  }
  if (paper === "a4") {
    style.textContent = "@page { size: A4; margin: 14mm; }";
    return;
  }
  const sheet = document.querySelector<HTMLElement>(".day-report-sheet");
  const heightMm = Math.ceil(((sheet?.offsetHeight ?? 0) * 25.4) / 96) + 2;
  style.textContent = `@page { size: 80mm ${Math.max(heightMm, 100)}mm; margin: 0; }`;
}

// The bar above the end-of-day report (never printed): back, paper, Print.
export function DayReportControls({
  date,
  label,
  paper,
  back,
}: {
  date: string;
  label: string;
  paper: DayReportPaper;
  back: { href: string; label: string };
}) {
  React.useEffect(() => {
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (!cancelled) setPageSize(paper);
    });
    return () => {
      cancelled = true;
    };
  }, [paper]);

  React.useEffect(() => () => document.getElementById(PAGE_STYLE_ID)?.remove(), []);

  return (
    <div className="sticky top-0 z-10 border-b border-pos-border bg-pos-surface print:hidden">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 p-3">
        <Link
          href={back.href}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium hover:bg-pos-subtle focus-visible:outline-2 focus-visible:outline-pos-accent"
        >
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="display-type truncate text-2xl leading-none">End-of-day report</h1>
          <p className="text-xs text-pos-text-muted">{label}</p>
        </div>
        <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
          <nav aria-label="Paper" className="flex rounded-[10px] border border-pos-border p-0.5">
            {(["80mm", "a4"] as const).map((option) => (
              <Link
                key={option}
                href={`/pos/day-report/${date}?paper=${option}`}
                replace
                scroll={false}
                aria-current={paper === option ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-[8px] px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
                  paper === option ? "bg-pos-text text-pos-surface" : "hover:bg-pos-subtle",
                )}
              >
                {option === "80mm" ? "80mm roll" : "A4 paper"}
              </Link>
            ))}
          </nav>
          <PosButton
            onClick={() => {
              setPageSize(paper);
              window.print();
            }}
          >
            <Printer /> Print
          </PosButton>
        </div>
      </div>
    </div>
  );
}
