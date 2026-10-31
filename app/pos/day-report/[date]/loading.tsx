import { Skeleton } from "@/components/ui/skeleton";

export default function DayReportLoading() {
  return (
    <>
      <div className="h-[69px] border-b border-pos-border bg-pos-surface" />
      <main className="flex flex-1 justify-center p-4 md:p-8" aria-busy="true" aria-label="Loading the end-of-day report">
        <div className="w-full max-w-[210mm] space-y-3 bg-white p-6 shadow-sm">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </div>
      </main>
    </>
  );
}
