import { KpiTileSkeleton } from "@/components/brand-pos/kpi-tile";
import { Skeleton } from "@/components/ui/skeleton";

export default function SalesLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading sales">
      <Skeleton className="mb-6 h-10 w-40" />
      <Skeleton className="mb-4 h-32 w-full rounded-[16px]" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <KpiTileSkeleton key={index} />
        ))}
      </div>
      <div className="space-y-2 rounded-[16px] border border-pos-border bg-pos-surface p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </main>
  );
}
