import { Skeleton } from "@/common/components/ui/Skeleton";

export const RecalibrateSkeleton = () => {
  return (
    <div className="rc-client-grid" style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
      {/* Left rail skeleton */}
      <div className="rc-rail" style={{ width: '280px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <Skeleton className="h-10 w-full rounded-lg" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card" style={{ padding: '0.65rem 0.75rem', display: 'flex', gap: '0.65rem' }}>
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div style={{ flex: 1 }}>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-3 w-20 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Main workspace skeleton */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="glass-card" style={{ padding: '2rem' }}>
          {/* Hero header skeleton */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)' }}>
            <Skeleton className="h-16 w-16 rounded-full" />
            <div style={{ flex: 1 }}>
              <Skeleton className="h-7 w-48 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-32 rounded-lg" />
          </div>

          {/* Spec inputs skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            {[1, 2, 3].map((i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>

          {/* Questions skeleton */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card" style={{ padding: '1.5rem' }}>
                <Skeleton className="h-5 w-64 mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
