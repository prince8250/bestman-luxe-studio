import { KpiTileSkeleton } from "@/components/brand-pos/kpi-tile";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading the customer">
      <Skeleton className="mb-4 h-5 w-24" />
      <Skeleton className="mb-6 h-10 w-56" />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <KpiTileSkeleton key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-64 rounded-[16px]" />
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    </main>
  );
}
