"use client";

import { Download } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";

// Saves a file built on the server (CSV or HTML) without another request.
export function DownloadButton({ content, filename, type, label }: { content: string; filename: string; type: string; label: string }) {
  function download() {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <PosButton variant="secondary" onClick={download} className="print:hidden">
      <Download /> {label}
    </PosButton>
  );
}
