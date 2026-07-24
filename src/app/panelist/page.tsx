import { getPanelistSession } from '@server/lib/session';
import { db } from '@server/lib/db';
import { redirect } from 'next/navigation';
import { Calendar, LogOut } from 'lucide-react';
import { PanelistClient } from '@/panelist/components/PanelistClient';
import { ThemeToggle } from '@/common/components/ThemeToggle';

export const dynamic = 'force-dynamic';

export default async function PanelistPage() {
  const session = await getPanelistSession();

  if (!session) {
    redirect('/');
  }

  const [interviews, pendingRequests, panelistRecord, activeDrive] = await Promise.all([
    db.getPanelistInterviews(session.user.email),
    db.getPanelistRequests(session.user.email),
    db.getPanelistByEmail(session.user.email),
    db.getActiveDrive(),
  ]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner" style={{ maxWidth: '1200px' }}>
          <div className="brand-lockup">
            <div className="brand-mark">
              <Calendar size={20} />
            </div>
            <div>
              <div className="brand-name">
                Panel<span>Sync</span>
              </div>
              <div className="brand-context">Panelist Portal</div>
            </div>
          </div>

          <div className="header-actions">
            <ThemeToggle />
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
      
      <main className="app-main">
        <div className="app-container" style={{ maxWidth: '1200px' }}>
          <PanelistClient
            initialInterviews={interviews}
            initialRequests={pendingRequests}
            panelistRoles={panelistRecord?.roles ?? []}
            panelistName={session.user.displayName}
            activeDrive={activeDrive}
          />
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-container flex-between text-muted text-xs" style={{ maxWidth: '1200px' }}>
          <p>© 2026 PanelSync. Panelist Portal.</p>
        </div>
      </footer>
    </div>
  );
}

