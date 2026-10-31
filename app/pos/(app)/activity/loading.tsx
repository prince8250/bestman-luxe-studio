import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading the activity feed">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2 rounded-[16px] border border-pos-border bg-pos-surface p-4">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex gap-3 py-2">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-[16px]" />
      </div>
    </main>
  );
}
