"use client";

import { Download, Printer } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";

// Export the period (spec 15): the summary as a CSV file, or print the page
// (the POS menus are hidden when printing).
export function ExportButtons({ csv, filename }: { csv: string; filename: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 print:hidden">
      <PosButton variant="secondary" onClick={download}>
        <Download /> CSV
      </PosButton>
      <PosButton variant="secondary" onClick={() => window.print()}>
        <Printer /> Print
      </PosButton>
    </div>
  );
}
