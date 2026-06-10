import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import DashboardClient from './DashboardClient';
import { Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();

  // If not logged in, redirect to login page
  if (!session) {
    redirect('/');
  }

  // Load interviews from JSON database
  const interviews = await db.getInterviews();
  const panelists = await db.getPanelists();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header navbar */}
      <header style={{ borderBottom: '1px solid var(--border-glass)', padding: '1rem 0', background: 'rgba(0, 0, 0, 0.2)' }}>
        <div className="container flex-between">
          <div className="flex-gap-4">
            <div style={{ backgroundColor: 'var(--primary)', padding: '0.4rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
              <Calendar size={20} color="#ffffff" />
            </div>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              Panel<span className="gradient-accent-text">Sync</span>
            </span>
            <div style={{ borderLeft: '1px solid var(--border-glass)', height: '20px', marginLeft: '8px', paddingLeft: '12px' }} className="text-muted text-sm">
              Recruiter Portal
            </div>
          </div>
          
          <div className="flex-gap-4">
            <div className="text-right" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{session.user.displayName}</span>
              <span className="text-muted text-xs">{session.user.email}</span>
            </div>
            <a href="/api/auth/signout" className="btn btn-secondary btn-sm" style={{ padding: '0.4rem 1rem' }}>
              Sign Out
            </a>
          </div>
        </div>
      </header>

      {/* Main Dashboard Panel */}
      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          <DashboardClient initialInterviews={interviews} initialPanelists={panelists} />
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--border-glass)', padding: '1.5rem 0', marginTop: 'auto', background: 'rgba(0, 0, 0, 0.1)' }}>
        <div className="container flex-between text-muted text-xs">
          <p>© 2026 PanelSync. Authenticated session active.</p>
          <p>Connected to MS Tenant ID: {process.env.AZURE_TENANT_ID || 'common'}</p>
        </div>
      </footer>
    </div>
  );
}
