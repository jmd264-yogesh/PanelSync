import { db } from '@/lib/db';
import AvailabilityClient from './AvailabilityClient';
import { AlertCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AvailabilityPage({ params }: PageProps) {
  const { token } = await params;

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card text-center" style={{ maxWidth: '400px' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
          <h3>Invalid Access Token</h3>
          <p className="text-muted text-sm mt-4">
            The link you followed is missing a valid security token. Please verify the URL sent to you in Microsoft Teams.
          </p>
        </div>
      </div>
    );
  }

  // Look up panel details by token
  const result = db.getInterviewByPanelToken(token);

  if (!result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card text-center" style={{ maxWidth: '400px' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
          <h3>Invite Link Expired</h3>
          <p className="text-muted text-sm mt-4">
            This interview request could not be found or has been removed by the recruiter. If you believe this is an error, please reach out to the coordinator.
          </p>
        </div>
      </div>
    );
  }

  const { interview, panel } = result;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '3rem 0', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: '720px' }}>
          <AvailabilityClient interview={interview} panel={panel} />
        </div>
      </main>
    </div>
  );
}
