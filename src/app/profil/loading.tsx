import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-4 w-48 mb-6" />

      <div className="space-y-5">
        <div className="flex justify-center mb-4">
          <Skeleton className="h-20 w-20 rounded-full" />
        </div>

        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        ))}

        <Skeleton className="h-11 rounded-lg mt-4" />
      </div>
    </main>
  );
}
