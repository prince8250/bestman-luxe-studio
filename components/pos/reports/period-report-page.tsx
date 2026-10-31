import type { ReactNode } from "react";

import { PeriodReportView } from "@/components/pos/reports/period-report";
import { loadPeriodReport } from "@/lib/reports/period";
import type { Period } from "@/lib/reports/periods";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Loads one period's report on the server and shows it (spec 16).
export async function PeriodReportPage({
  title,
  basePath,
  period,
  picker,
  notice,
}: {
  title: string;
  basePath: string;
  period: Period;
  picker: ReactNode;
  notice?: ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const [report, settings] = await Promise.all([
    loadPeriodReport(supabase, period.range),
    supabase.from("studio_settings").select("studio_name").eq("id", true).maybeSingle(),
  ]);
  return (
    <PeriodReportView
      title={title}
      basePath={basePath}
      period={period}
      report={report}
      studioName={settings.data?.studio_name ?? "Bestman Luxe Studio"}
      picker={picker}
      notice={notice}
    />
  );
}
