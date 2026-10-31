import type { Metadata } from "next";

import { OwnerOnly } from "@/components/pos/owner-only";
import { DateJump } from "@/components/pos/reports/date-jump";
import { PeriodReportPage } from "@/components/pos/reports/period-report-page";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { firstParam } from "@/lib/params";
import { weeklyPeriod } from "@/lib/reports/periods";
import { accraDate } from "@/lib/time";

export const metadata: Metadata = { title: "Weekly report" };

// One Monday-to-Sunday week (spec 16), ?week=<any date in the week>.
export default async function WeeklyReportPage({ searchParams }: PageProps<"/pos/reports/weekly">) {
  const { allowed } = await pageAccess("reports.view");
  if (!allowed) return <OwnerOnly />;
  const today = accraDate();
  const period = weeklyPeriod(firstParam((await searchParams).week), today);
  return (
    <PeriodReportPage
      title="Weekly report"
      basePath="/pos/reports/weekly"
      period={period}
      picker={<DateJump action="/pos/reports/weekly" name="week" type="date" value={period.range.from} max={today} label="A day in the week" />}
    />
  );
}
