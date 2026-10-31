import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";

import { DayReportControls } from "@/components/pos/reports/day-report-controls";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { firstParam } from "@/lib/params";
import { PAPER_COOKIE, parsePaper } from "@/lib/receipt/receipt";
import { dayReportBody, dayReportCss } from "@/lib/reports/day-report-html";
import { isCalendarDate } from "@/lib/reports/range";
import { ReportError, reportDayCloseExport, type DayReport } from "@/lib/reports/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatBusinessDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "End-of-day report" };

// The end-of-day report for printing (spec 16): the same HTML the PC backup
// saves (lib/reports/day-report-html), outside the POS shell so only the
// report prints. Paper: ?paper=80mm|a4, else this device's receipt paper.
// The owner can open any day; a counter user only a closed day.
export default async function DayReportPage({ params, searchParams }: PageProps<"/pos/day-report/[date]">) {
  const { user, allowed } = await pageAccess("day.closeReport");
  const { date } = await params;
  const query = await searchParams;
  const back = user.role === "owner" ? { href: `/pos/reports/daily?date=${date}`, label: "Daily report" } : { href: "/pos/close-day", label: "Close day" };
  if (!allowed || !isCalendarDate(date)) return <Unavailable title="Report not found" text="Choose a day from the Reports or Close day page." back={back} />;

  const supabase = await createSupabaseServerClient();
  let day: DayReport;
  try {
    day = await reportDayCloseExport(supabase, date);
  } catch (error) {
    if (error instanceof ReportError && error.code === "not_closed") {
      return <Unavailable title="Day not closed yet" text="The end-of-day report opens after the cash is counted and the day is closed." back={back} />;
    }
    throw error;
  }

  const paper = parsePaper(firstParam(query.paper) || (await cookies()).get(PAPER_COOKIE)?.value);

  return (
    <>
      <style>{dayReportCss(paper)}</style>
      <DayReportControls date={date} label={formatBusinessDate(date)} paper={paper} back={back} />
      <main className="flex-1 overflow-x-auto p-4 md:p-8 print:overflow-visible print:p-0">
        <div
          className={cn(
            "day-report-sheet mx-auto bg-white shadow-sm print:shadow-none",
            paper === "a4" ? "w-[210mm] max-w-full p-[14mm] print:w-auto print:p-0" : "w-[80mm] py-[4mm]",
          )}
          // dayReportBody escapes every value from the database.
          dangerouslySetInnerHTML={{ __html: dayReportBody(day) }}
        />
      </main>
    </>
  );
}

function Unavailable({ title, text, back }: { title: string; text: string; back: { href: string; label: string } }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-[16px] border border-pos-border bg-pos-surface p-6 text-center">
        <h1 className="display-type text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-pos-text-muted">{text}</p>
        <Link
          href={back.href}
          className="mt-5 inline-flex min-h-11 items-center rounded-[10px] bg-pos-accent px-4 text-sm font-medium text-pos-on-accent hover:opacity-90"
        >
          Back to {back.label}
        </Link>
      </div>
    </main>
  );
}
