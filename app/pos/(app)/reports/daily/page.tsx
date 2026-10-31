import type { Metadata } from "next";

import { OwnerOnly } from "@/components/pos/owner-only";
import { DateJump } from "@/components/pos/reports/date-jump";
import { PeriodReportPage } from "@/components/pos/reports/period-report-page";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { firstParam } from "@/lib/params";
import { dailyPeriod } from "@/lib/reports/periods";
import { accraDate } from "@/lib/time";

export const metadata: Metadata = { title: "Daily report" };

// The end-of-day report (spec 16): one business day, ?date=YYYY-MM-DD.
export default async function DailyReportPage({ searchParams }: PageProps<"/pos/reports/daily">) {
  const { allowed } = await pageAccess("reports.view");
  if (!allowed) return <OwnerOnly />;
  const today = accraDate();
  const period = dailyPeriod(firstParam((await searchParams).date), today);
  return (
    <PeriodReportPage
      title="Daily report"
      basePath="/pos/reports/daily"
      period={period}
      picker={<DateJump action="/pos/reports/daily" name="date" type="date" value={period.range.from} max={today} label="Day" />}
    />
  );
}
