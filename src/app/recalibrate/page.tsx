import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Gauge, LogOut } from 'lucide-react';
import RecalibrateWorkspaceClient from './RecalibrateWorkspaceClient';

export const dynamic = 'force-dynamic';

export default async function RecalibratePage() {
  const session = await getPanelistSession();
  if (!session) {
    redirect('/');
  }

  const allInterviews = await db.getPanelistInterviews(session.user.email);
  const lateralInterviews = allInterviews.filter((i) => i.hiringType === 'LATERAL');

  return (
    <div className="app-shell" style={{ background: 'var(--bg-main)' }}>
      <header className="app-header">
        <div className="app-container app-header-inner" style={{ maxWidth: '1600px' }}>
          <div className="brand-lockup">
            <div className="brand-mark" style={{ background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)' }}>
              <Gauge size={20} />
            </div>
            <div>
              <div className="brand-name">
                Recalibrate<span>.</span>
              </div>
              <div className="brand-context">DE CoE Interview Console</div>
            </div>
          </div>

          <div className="header-actions">
            <a href="/panelist" className="header-signout" style={{ textDecoration: 'none' }}>
              <span>Panelist Portal</span>
            </a>
            <div className="user-summary">
              <div className="user-avatar">
                {session.user.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="user-copy">
                <span>{session.user.displayName}</span>
                <small>{session.user.email}</small>
              </div>
            </div>
            <a href="/api/auth/signout" className="header-signout">
              <LogOut size={14} />
              <span>Sign out</span>
            </a>
          </div>
        </div>
      </header>

      <main className="app-main" style={{ paddingTop: '1.5rem' }}>
        <div className="app-container" style={{ maxWidth: 'none' }}>
          <Suspense fallback={null}>
            <RecalibrateWorkspaceClient
              initialInterviews={lateralInterviews}
              panelistName={session.user.displayName}
            />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
