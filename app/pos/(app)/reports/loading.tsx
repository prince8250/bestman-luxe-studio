import { KpiTileSkeleton } from "@/components/brand-pos/kpi-tile";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading the report">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-11 w-64 rounded-[10px]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <KpiTileSkeleton key={index} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-48 rounded-[16px]" />
        ))}
      </div>
    </main>
  );
}
