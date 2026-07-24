import { Skeleton } from "@/common/components/ui/Skeleton";

export const AvailabilitySkeleton = () => {
  return (
    <div className="glass-card max-w-2xl mx-auto backdrop-blur-md bg-white/5 border border-white/10 rounded-xl p-6 shadow-xl">
      {/* Title block skeleton */}
      <div className="border-b border-white/10 pb-5 mb-5">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-7 w-64 mb-2" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      {/* Interview metadata skeleton */}
      <div className="bg-white/[0.02] border border-white/5 rounded-lg p-4 grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>

      {/* Scheduled slots skeleton */}
      <div className="mb-6">
        <Skeleton className="h-5 w-48 mb-3" />
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-white/10" />
        <Skeleton className="h-3 w-8" />
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Form skeleton */}
      <div className="mb-4">
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1fr_auto] gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      {/* Submit button skeleton */}
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
};
