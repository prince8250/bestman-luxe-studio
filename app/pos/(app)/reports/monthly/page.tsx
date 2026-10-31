import type { Metadata } from "next";

import { OwnerOnly } from "@/components/pos/owner-only";
import { DateJump } from "@/components/pos/reports/date-jump";
import { PeriodReportPage } from "@/components/pos/reports/period-report-page";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { firstParam } from "@/lib/params";
import { monthlyPeriod } from "@/lib/reports/periods";
import { accraDate } from "@/lib/time";

export const metadata: Metadata = { title: "Monthly report" };

// One calendar month (spec 16), ?month=YYYY-MM.
export default async function MonthlyReportPage({ searchParams }: PageProps<"/pos/reports/monthly">) {
  const { allowed } = await pageAccess("reports.view");
  if (!allowed) return <OwnerOnly />;
  const today = accraDate();
  const period = monthlyPeriod(firstParam((await searchParams).month), today);
  return (
    <PeriodReportPage
      title="Monthly report"
      basePath="/pos/reports/monthly"
      period={period}
      picker={
        <DateJump action="/pos/reports/monthly" name="month" type="month" value={period.range.from.slice(0, 7)} max={today.slice(0, 7)} label="Month" />
      }
    />
  );
}
