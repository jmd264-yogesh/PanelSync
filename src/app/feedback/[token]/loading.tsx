import { FeedbackSkeleton } from "@/feedback/components/FeedbackSkeleton";

export default function FeedbackLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '3rem 0', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: '680px' }}>
          <FeedbackSkeleton />
        </div>
      </main>
    </div>
  );
}
