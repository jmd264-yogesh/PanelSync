import { Calendar, LogOut, Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';

import { ThemeToggle } from '@/common/components/ThemeToggle';
import { db } from '@server/lib/db';
import { getSession } from '@server/lib/session';
import { DashboardClient } from '@/dashboard/components/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) redirect('/');

  const [interviews, panelists, colleges] = await Promise.all([
    db.getInterviews(),
    db.getPanelists(),
    db.getColleges(),
  ]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-container app-header-inner">
          <div className="brand-lockup">
            <div className="brand-mark"><Calendar size={20} /></div>
            <div>
              <div className="brand-name">Panel<span>Sync</span></div>
              <div className="brand-context"><Sparkles size={11} /> Recruiter workspace</div>
            </div>
          </div>

          <div className="header-actions">
            <ThemeToggle />
            <div className="user-summary">
              <div className="user-avatar">{session.user.displayName.slice(0, 1).toUpperCase()}</div>
              <div className="user-copy">
                <span>{session.user.displayName}</span>
                <small>{session.user.email}</small>
              </div>
            </div>
            <a href="/api/auth/signout" className="header-signout">
              <LogOut size={15} /> <span>Sign out</span>
            </a>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-container">
          <DashboardClient
            initialInterviews={interviews}
            initialPanelists={panelists}
            initialColleges={colleges}
          />
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-container flex-between text-muted text-xs">
          <p>© 2026 PanelSync. Authenticated session active.</p>
          <p>Connected to Microsoft tenant</p>
        </div>
      </footer>
    </div>
  );
}

