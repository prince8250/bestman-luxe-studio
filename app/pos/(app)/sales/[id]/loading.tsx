import { Skeleton } from "@/components/ui/skeleton";

export default function SaleLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-8" aria-busy="true" aria-label="Loading the sale">
      <Skeleton className="mb-4 h-5 w-20" />
      <Skeleton className="mb-6 h-10 w-64" />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <Skeleton className="h-56 rounded-[16px]" />
          <Skeleton className="h-32 rounded-[16px]" />
        </div>
        <Skeleton className="h-64 rounded-[16px]" />
      </div>
    </main>
  );
}
