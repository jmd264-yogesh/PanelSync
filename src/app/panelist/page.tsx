import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Calendar } from 'lucide-react';
import PanelistClient from './PanelistClient';

export const dynamic = 'force-dynamic';

export default async function PanelistPage() {
  const session = await getPanelistSession();

  if (!session) {
    redirect('/');
  }

  const [interviews, panelistRecord] = await Promise.all([
    db.getPanelistInterviews(session.user.email),
    db.getPanelistByEmail(session.user.email),
  ]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
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
              Panelist Portal
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

      <main style={{ flex: 1, padding: '2rem 0' }}>
        <div className="container">
          <PanelistClient
            initialInterviews={interviews}
            panelistRoles={panelistRecord?.roles ?? []}
            panelistName={session.user.displayName}
          />
        </div>
      </main>

      <footer style={{ borderTop: '1px solid var(--border-glass)', padding: '1.5rem 0', marginTop: 'auto', background: 'rgba(0, 0, 0, 0.1)' }}>
        <div className="container flex-between text-muted text-xs">
          <p>© 2026 PanelSync. Panelist Portal.</p>
        </div>
      </footer>
    </div>
  );
}
