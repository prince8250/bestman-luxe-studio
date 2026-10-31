import { ReportTabs } from "@/components/pos/reports/report-tabs";
import { can } from "@/lib/auth/permissions";
import { requirePosUser } from "@/lib/auth/require-pos-user";

// Reports (spec 16) share the section tabs. A counter user gets no tabs; each
// page shows them "This page is for the owner" (pageAccess).
export default async function ReportsLayout({ children }: LayoutProps<"/pos/reports">) {
  const user = await requirePosUser();
  if (!can(user.role, "reports.view")) return children;
  return (
    <>
      <ReportTabs />
      {children}
    </>
  );
}
