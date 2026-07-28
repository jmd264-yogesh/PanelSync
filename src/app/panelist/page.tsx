import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Calendar, LogOut, GraduationCap, Gauge, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { getInterviewInfo } from '@/lib/interview-role';

export const dynamic = 'force-dynamic';

export default async function PanelistLandingPage() {
  const session = await getPanelistSession();

  if (!session) {
    redirect('/');
  }

  const [allInterviews, allRequests] = await Promise.all([
    db.getPanelistInterviews(session.user.email),
    db.getPanelistRequests(session.user.email),
  ]);

  const campusInterviews = allInterviews.filter((i) => i.hiringType !== 'LATERAL');
  const campusPending = allRequests.filter((r) => r.interview.hiringType !== 'LATERAL');

  const lateralInterviews = allInterviews.filter((i) => i.hiringType === 'LATERAL');
  const lateralCounts = lateralInterviews.reduce(
    (acc, i) => {
      const round = getInterviewInfo(i.role).round;
      if (round === 'L1') acc.l1 += 1;
      else if (round === 'L2') acc.l2 += 1;
      return acc;
    },
    { l1: 0, l2: 0 },
  );

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

      <main className="app-main" style={{ display: 'flex', alignItems: 'center', minHeight: 'calc(100vh - 140px)' }}>
        <div className="app-container" style={{ maxWidth: '900px' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>Which portal do you need?</h1>
            <p className="text-muted" style={{ margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
              Welcome back, {session.user.displayName.split(' ')[0]} — pick a hiring track to get started.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            <a
              href="/panelist/campus"
              className="glass-card"
              style={{
                display: 'flex', flexDirection: 'column', gap: '0.9rem', padding: '1.75rem',
                textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-glass)',
                transition: 'var(--transition-fast, all 0.15s ease)',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px',
                borderRadius: '14px', background: 'var(--primary-glow)', color: 'var(--primary)',
              }}>
                <GraduationCap size={26} />
              </span>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Campus Hiring</h2>
                <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', lineHeight: 1.55 }}>
                  Review panel requests, run L1/L2 campus interviews, and submit feedback for college drive candidates.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                <span className="badge">{campusInterviews.length} interview{campusInterviews.length === 1 ? '' : 's'}</span>
                {campusPending.length > 0 && <span className="badge badge-pending">{campusPending.length} pending request{campusPending.length === 1 ? '' : 's'}</span>}
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>
                Open Campus Hiring <ArrowRight size={14} />
              </span>
            </a>

            <a
              href="/recalibrate"
              className="glass-card"
              style={{
                display: 'flex', flexDirection: 'column', gap: '0.9rem', padding: '1.75rem',
                textDecoration: 'none', color: 'inherit', border: '1px solid var(--border-glass)',
                transition: 'var(--transition-fast, all 0.15s ease)',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px',
                borderRadius: '14px', background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
              }}>
                <Gauge size={26} />
              </span>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Lateral Hiring — Recalibrate</h2>
                <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', lineHeight: 1.55 }}>
                  Generate role-specific questions, score against the organization's rubric, and submit assessments for lateral candidates.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: 'auto' }}>
                <span className="badge">{lateralInterviews.length} candidate{lateralInterviews.length === 1 ? '' : 's'}</span>
                {lateralCounts.l1 > 0 && <span className="badge" style={{ background: 'var(--badge-l1-bg)', color: 'var(--badge-l1-text)', border: '1px solid var(--badge-l1-border)' }}>{lateralCounts.l1} L1</span>}
                {lateralCounts.l2 > 0 && <span className="badge" style={{ background: 'var(--badge-l2-bg)', color: 'var(--badge-l2-text)', border: '1px solid var(--badge-l2-border)' }}>{lateralCounts.l2} L2</span>}
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--rc-brand, #7c3aed)' }}>
                Open Recalibrate <ArrowRight size={14} />
              </span>
            </a>
          </div>
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
