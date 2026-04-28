import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <>
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-6" />

        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>

        <div className="mt-10 space-y-3">
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>

        <div className="mt-10 space-y-3">
          <Skeleton className="h-6 w-40 mb-3" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </main>
    </>
  );
}
