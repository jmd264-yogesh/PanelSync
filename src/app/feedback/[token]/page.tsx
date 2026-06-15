import { db } from '@/lib/db';
import FeedbackClient from './FeedbackClient';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export default async function FeedbackPage({ params }: PageProps) {
  const { token } = await params;

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card text-center" style={{ maxWidth: '400px' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
          <h3>Invalid Access Token</h3>
          <p className="text-muted text-sm mt-4">
            The link you followed is missing a valid security token. Please use the link sent to you in Microsoft Teams.
          </p>
        </div>
      </div>
    );
  }

  const result = await db.getInterviewByPanelToken(token);

  if (!result) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card text-center" style={{ maxWidth: '400px' }}>
          <AlertCircle size={48} style={{ color: 'var(--danger)', margin: '0 auto 1rem' }} />
          <h3>Link Expired or Not Found</h3>
          <p className="text-muted text-sm mt-4">
            This feedback link could not be found or has been removed. Please contact your interview coordinator.
          </p>
        </div>
      </div>
    );
  }

  const { interview, panel } = result;

  if (interview.status !== 'SCHEDULED') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div className="glass-card text-center" style={{ maxWidth: '420px' }}>
          <AlertCircle size={48} style={{ color: '#f59e0b', margin: '0 auto 1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Interview Not Yet Scheduled</h3>
          <p className="text-muted text-sm mt-4">
            Feedback can only be submitted after the interview has been confirmed and scheduled. Please check back after the interview is booked.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <main style={{ flex: 1, padding: '3rem 0', display: 'flex', alignItems: 'center' }}>
        <div className="container" style={{ maxWidth: '680px' }}>
          <FeedbackClient interview={interview} panel={panel} />
        </div>
      </main>
    </div>
  );
}
