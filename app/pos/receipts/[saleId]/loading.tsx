import { Skeleton } from "@/components/ui/skeleton";

export default function ReceiptLoading() {
  return (
    <>
      <div className="h-[69px] border-b border-pos-border bg-pos-surface" />
      <main className="flex flex-1 justify-center p-4 md:p-8" aria-busy="true" aria-label="Loading the receipt">
        <div className="w-[80mm] space-y-3 bg-white p-[4mm] shadow-sm">
          <Skeleton className="mx-auto h-20 w-20 rounded-full" />
          <Skeleton className="mx-auto h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </main>
    </>
  );
}
