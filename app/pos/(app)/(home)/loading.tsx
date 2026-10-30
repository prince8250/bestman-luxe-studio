import { KpiTileSkeleton } from "@/components/brand-pos/kpi-tile";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading the dashboard">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-11 w-72 rounded-[10px]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <KpiTileSkeleton key={index} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Skeleton className="h-96 rounded-[16px] xl:col-span-2" />
        <Skeleton className="h-96 rounded-[16px]" />
        <Skeleton className="h-64 rounded-[16px] xl:col-span-2" />
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    </main>
  );
}
