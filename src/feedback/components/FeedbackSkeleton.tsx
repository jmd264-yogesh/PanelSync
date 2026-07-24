import { Skeleton } from "@/common/components/ui/Skeleton";

export const FeedbackSkeleton = () => {
  return (
    <div className="glass-card" style={{ padding: '2rem 2rem 2.5rem' }}>
      {/* Header skeleton */}
      <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '1.5rem', marginBottom: '1.75rem' }}>
        <Skeleton className="h-6 w-40 mb-3" />
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      {/* Metadata grid skeleton */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.75rem',
          marginBottom: '1.75rem',
          padding: '1rem',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <Skeleton className="h-4 w-4 rounded-full" />
            <div style={{ flex: 1 }}>
              <Skeleton className="h-3 w-16 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Decision buttons skeleton */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Skeleton className="h-4 w-28 mb-2" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Skeleton className="h-28 w-full rounded-lg" />
          <Skeleton className="h-28 w-full rounded-lg" />
        </div>
      </div>

      {/* Feedback textarea skeleton */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>

      {/* Submit button skeleton */}
      <Skeleton className="h-12 w-full rounded-lg" />
    </div>
  );
};
