import { Skeleton } from "@/components/ui/skeleton";

// Shown while the catalog loads.
export default function ServicesLoading() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8" aria-busy="true">
      <Skeleton className="mb-6 h-10 w-48 bg-pos-subtle" />
      <Skeleton className="mb-4 h-12 w-80 bg-pos-subtle" />
      {Array.from({ length: 2 }, (_, section) => (
        <div key={section} className="mb-6 rounded-[16px] border border-pos-border bg-pos-surface p-4">
          <Skeleton className="mb-4 h-7 w-56 bg-pos-subtle" />
          {Array.from({ length: 3 }, (_, row) => (
            <div key={row} className="flex items-center gap-3 border-t border-pos-border py-3 first:border-t-0">
              <Skeleton className="h-12 w-12 rounded-[10px] bg-pos-subtle" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40 bg-pos-subtle" />
                <Skeleton className="h-3 w-56 bg-pos-subtle" />
              </div>
              <Skeleton className="h-7 w-24 bg-pos-subtle" />
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}
