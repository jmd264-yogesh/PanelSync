import { AvailabilitySkeleton } from "@/availability/components/AvailabilitySkeleton";

export default function AvailabilityLoading() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '3rem 0', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: '720px' }}>
          <AvailabilitySkeleton />
        </div>
      </main>
    </div>
  );
}
