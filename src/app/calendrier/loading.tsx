import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-4 w-72 mb-6" />

      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </main>
  );
}
