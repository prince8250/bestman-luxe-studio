import type { Metadata } from "next";

import { OwnerOnly } from "@/components/pos/owner-only";
import { RangeJump } from "@/components/pos/reports/date-jump";
import { PeriodReportPage } from "@/components/pos/reports/period-report-page";
import { RangeTooLong } from "@/components/pos/reports/report-parts";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { firstParam } from "@/lib/params";
import { customPeriod } from "@/lib/reports/periods";
import { isRangeTooLong } from "@/lib/reports/range";
import { accraDate, addDays } from "@/lib/time";

export const metadata: Metadata = { title: "Report" };

// Any range of days (spec 16), ?from=YYYY-MM-DD&to=YYYY-MM-DD. Opens on the
// last 7 days, and goes back to them when the range is over two years.
export default async function CustomReportPage({ searchParams }: PageProps<"/pos/reports/custom">) {
  const { allowed } = await pageAccess("reports.view");
  if (!allowed) return <OwnerOnly />;
  const params = await searchParams;
  const today = accraDate();
  const lastWeek = customPeriod(addDays(today, -6), today, today);
  const requested = customPeriod(firstParam(params.from) || lastWeek.range.from, firstParam(params.to) || today, today);
  const tooLong = isRangeTooLong(requested.range);
  const period = tooLong ? lastWeek : requested;
  return (
    <PeriodReportPage
      title="Report"
      basePath="/pos/reports/custom"
      period={period}
      picker={<RangeJump action="/pos/reports/custom" from={requested.range.from} to={requested.range.to} max={today} />}
      notice={tooLong && <RangeTooLong showing="the last 7 days" />}
    />
  );
}
