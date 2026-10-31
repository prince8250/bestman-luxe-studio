import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/brand-pos/page-header";
import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { DownloadDayReportButton, PrintSlipButton, ReopenDayButton } from "@/components/pos/close-day/close-day-buttons";
import { CloseDayForm } from "@/components/pos/close-day/close-day-form";
import { CloseResult, CloseSlip, PastCloses } from "@/components/pos/close-day/close-result";
import { OwnerOnly } from "@/components/pos/owner-only";
import { AutoSelect } from "@/components/pos/reports/auto-select";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { loadClosedDay, loadUnclosedDays } from "@/lib/close-day/data";
import { firstParam } from "@/lib/params";
import { isCalendarDate } from "@/lib/reports/range";
import { reportDayClose } from "@/lib/reports/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accraDate, addDays, formatBusinessDate } from "@/lib/time";

export const metadata: Metadata = { title: "Close day" };

const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const short = (date: string) => shortDay.format(new Date(`${date}T00:00:00Z`));

// Close day (spec 17), ?date=YYYY-MM-DD (today by default; an earlier day
// that was not closed can be chosen). Step 1 is the blind count; once the
// day has an active close the page shows step 2, the result. The owner also
// sees the past closes and can reopen a day.
export default async function CloseDayPage({ searchParams }: PageProps<"/pos/close-day">) {
  const { user, allowed } = await pageAccess("day.close");
  if (!allowed) return <OwnerOnly />;
  const owner = user.role === "owner";

  const params = await searchParams;
  const today = accraDate();
  const requested = firstParam(params.date);
  const date = isCalendarDate(requested) && requested <= today ? requested : today;

  const supabase = await createSupabaseServerClient();
  const [day, unclosed, settings, history] = await Promise.all([
    // Null until the day is closed: the expected cash is not read before that.
    loadClosedDay(supabase, date),
    loadUnclosedDays(supabase),
    supabase.from("studio_settings").select("studio_name, default_opening_float").eq("id", true).single(),
    owner ? reportDayClose(supabase, { from: addDays(today, -59), to: today }) : Promise.resolve(null),
  ]);
  const close = day?.day_closes.find((row) => row.active) ?? null;
  const dayLabel = date === today ? "today" : short(date);
  const studioName = settings.data?.studio_name ?? "Bestman Luxe Studio";

  const options = [
    { value: today, label: `Today, ${short(today)}` },
    ...unclosed.map((row) => ({
      value: row.business_date,
      label: `${short(row.business_date)}, not closed (${row.sales_count} ${row.sales_count === 1 ? "sale" : "sales"})`,
    })),
  ];
  if (!options.some((option) => option.value === date)) options.push({ value: date, label: short(date) });
  const missed = unclosed.filter((row) => row.business_date !== date);

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 md:p-8 print:p-0">
      <div className="print:hidden">
        <PageHeader
          title="Close day"
          description={close ? `${formatBusinessDate(date)}, closed` : `Count the cash for ${formatBusinessDate(date)}`}
          actions={
            options.length > 1 ? (
              <Form action="/pos/close-day">
                <AutoSelect name="date" label="Day to close" value={date} options={options} />
              </Form>
            ) : null
          }
        />

        {missed.length > 0 && !close && (
          <p role="status" className="mb-4 rounded-[10px] bg-pos-warning-soft px-3 py-2.5 text-sm text-pos-warning">
            Not closed yet: {missed.map((row) => short(row.business_date)).join(", ")}. Choose the day above to close it.
          </p>
        )}

        {close && day ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              <PrintSlipButton />
              <DownloadDayReportButton date={date} />
              <PosButton variant="secondary" asChild>
                <Link href={`/pos/day-report/${date}`}>
                  <FileText /> End-of-day report
                </Link>
              </PosButton>
              {owner && <ReopenDayButton date={date} dayLabel={short(date)} />}
            </div>
            <CloseResult day={day} close={close} />
            {!owner && <p className="mt-4 text-sm text-pos-text-muted">If the count was wrong, ask the owner to reopen the day.</p>}
          </>
        ) : (
          <PosCard>
            {/* key: a new form (empty count) for each day. */}
            <CloseDayForm key={date} date={date} dayLabel={dayLabel} defaultFloat={settings.data?.default_opening_float ?? 0} />
            <p className="mt-5 border-t border-pos-border pt-4 text-xs text-pos-text-muted">
              The POS shows what it expected only after the count is saved, so nobody counts towards a number. The day report then
              downloads to this computer as an extra copy.
            </p>
          </PosCard>
        )}

        {history && <PastCloses closes={history} />}
      </div>

      {close && day && <CloseSlip day={day} close={close} studioName={studioName} />}
    </main>
  );
}
