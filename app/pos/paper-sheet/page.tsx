import type { Metadata } from "next";

import { OwnerOnly } from "@/components/pos/owner-only";
import { PaperSheetControls } from "@/components/pos/sale/paper-sheet-controls";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Paper sales sheet" };

const ROWS = 22;
const COLUMNS = [
  { label: "Time", width: "w-[15mm]" },
  { label: "Customer phone", width: "w-[28mm]" },
  { label: "Service", width: "" },
  { label: "Staff", width: "w-[24mm]" },
  { label: "Amount (GHS)", width: "w-[20mm]" },
  { label: "Payment", width: "w-[29mm]" },
  { label: "Entered", width: "w-[17mm]" },
] as const;

// A blank A4 sheet (spec 12) for writing sales by hand when the internet or
// power is down. Print a few in advance and keep them at the counter. Every
// row is entered later with New sale → Record a past sale.
export default async function PaperSheetPage() {
  const { allowed } = await pageAccess("sale.recordPast");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("studio_settings").select("studio_name").eq("id", true).maybeSingle();
  const studioName = data?.studio_name ?? "Bestman Luxe Studio";

  return (
    <>
      {/* A4 portrait; only this page sets the paper size. */}
      <style>{"@page { size: A4 portrait; margin: 12mm; }"}</style>
      <PaperSheetControls />
      <main className="flex-1 overflow-x-auto p-4 md:p-8 print:overflow-visible print:p-0">
        <article className="mx-auto w-[186mm] bg-white p-[8mm] text-[11pt] text-black shadow-sm print:w-auto print:p-0 print:px-[1mm] print:shadow-none">
          <header className="flex items-end justify-between gap-4 border-b-2 border-black pb-2">
            <div>
              <p className="text-[9pt] tracking-wide uppercase">{studioName}</p>
              <h1 className="text-[18pt] font-bold">Paper sales sheet</h1>
            </div>
            <dl className="grid grid-cols-[auto_44mm] gap-x-2 gap-y-1.5 text-[10pt]">
              <dt>Date</dt>
              <dd className="border-b border-black" />
              <dt>Written by</dt>
              <dd className="border-b border-black" />
              <dt>Page</dt>
              <dd className="border-b border-black">
                <span className="invisible">0</span>
              </dd>
            </dl>
          </header>
          <p className="mt-2 text-[9pt]">
            Only when the POS cannot be reached. Later, enter every row in the POS:{" "}
            <strong>New sale → Record a past sale</strong>, with the real time, and tick &ldquo;Entered&rdquo;.
          </p>

          <table className="mt-3 w-full table-fixed border-collapse text-[10pt]">
            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column.label} className={`${column.width} border border-black px-1.5 py-1 text-left text-[9pt] font-semibold`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: ROWS }, (_, row) => (
                <tr key={row} className="h-[9.5mm]">
                  {COLUMNS.map((column) => (
                    <td key={column.label} className="border border-black px-1.5 align-middle text-[8pt]">
                      {column.label === "Payment" ? "Cash · MoMo · Card" : column.label === "Entered" ? "☐" : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="mt-3 grid grid-cols-3 gap-4 text-[10pt]">
            <p>
              Cash total: <span className="inline-block w-[28mm] border-b border-black" />
            </p>
            <p>
              MoMo total: <span className="inline-block w-[28mm] border-b border-black" />
            </p>
            <p>
              Card total: <span className="inline-block w-[28mm] border-b border-black" />
            </p>
          </footer>
        </article>
      </main>
    </>
  );
}
