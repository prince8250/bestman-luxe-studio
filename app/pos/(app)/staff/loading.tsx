import { Skeleton } from "@/components/ui/skeleton";

// Shown while the staff list loads.
export default function StaffLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8" aria-busy="true">
      <Skeleton className="mb-6 h-10 w-40 bg-pos-subtle" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-[16px] border border-pos-border bg-pos-surface p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-full bg-pos-subtle" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-28 bg-pos-subtle" />
                <Skeleton className="h-3 w-20 bg-pos-subtle" />
              </div>
            </div>
            <Skeleton className="mt-4 h-11 w-full bg-pos-subtle" />
          </div>
        ))}
      </div>
    </main>
  );
}
