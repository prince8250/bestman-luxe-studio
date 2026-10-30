import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading customers">
      <Skeleton className="mb-6 h-10 w-48" />
      <Skeleton className="mb-4 h-11 w-full max-w-xl rounded-[10px]" />
      <div className="space-y-2 rounded-[16px] border border-pos-border bg-pos-surface p-4">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    </main>
  );
}
