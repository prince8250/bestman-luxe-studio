"use client";

import { Download } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { saveFile } from "@/lib/download";

// Saves a file built on the server (CSV or HTML) without another request.
export function DownloadButton({ content, filename, type, label }: { content: string; filename: string; type: string; label: string }) {
  return (
    <PosButton variant="secondary" onClick={() => saveFile(content, filename, type)} className="print:hidden">
      <Download /> {label}
    </PosButton>
  );
}
