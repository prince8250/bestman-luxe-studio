import { Skeleton } from "@/components/ui/skeleton";

export default function CloseDayLoading() {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading Close day">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="mt-2 h-4 w-64" />
      <div className="mt-6 space-y-4 rounded-[16px] border border-pos-border bg-pos-surface p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full rounded-[16px]" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-40" />
      </div>
    </main>
  );
}
