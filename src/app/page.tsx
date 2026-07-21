export const dynamic = 'force-dynamic';

import { getSession, getPanelistSession } from '@server/lib/session';
import { redirect } from 'next/navigation';
import { Calendar, Shield, Cpu, Users } from 'lucide-react';

interface PageProps {
  searchParams?: Promise<{ error?: string }> | { error?: string };
}

export default async function Home(props: PageProps) {
  const resolvedParams = props.searchParams instanceof Promise 
    ? await props.searchParams 
    : props.searchParams;
  const error = resolvedParams?.error;
  const session = await getSession();

  // If already authenticated as recruiter, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  // If already authenticated as panelist, redirect to panelist portal
  const panelistSession = await getPanelistSession();
  if (panelistSession) {
    redirect('/panelist');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
      {/* Background Blobs for Atmospheric Depth */}
      <div className="bg-blob-orb bg-blob-orb-primary" />
      <div className="bg-blob-orb bg-blob-orb-secondary" />

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border-glass)', padding: '1.5rem 0', zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div className="container flex-between">
          <div className="flex-gap-4">
            <div style={{ display: 'grid', placeItems: 'center', width: '38px', height: '38px', borderRadius: '10px', color: 'white', background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-button)' }}>
              <Calendar size={20} />
            </div>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
              Panel<span className="gradient-accent-text">Sync</span>
            </span>
          </div>
          <a href="/api/auth/signin" className="btn btn-secondary btn-sm" style={{ minHeight: '36px' }}>
            Recruiter Sign In
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '4rem 0', zIndex: 10 }}>
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'center', gap: '4rem' }}>
            {/* Left Column: Title & Text */}
            <div>
              <div className="badge badge-info" style={{ marginBottom: '1.25rem', textTransform: 'none', fontWeight: 650, borderRadius: '8px' }}>
                Powered by Microsoft Graph API
              </div>
              
              {error === 'unauthorized_recruiter' && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  color: '#ef4444',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ fontWeight: 700 }}>Access Denied:</strong> Your email address is not registered as an authorized recruiter. Please contact a system administrator to request access.
                </div>
              )}

              {error === 'not_a_panelist' && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  color: '#ef4444',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ fontWeight: 700 }}>Access Denied:</strong> Your email is not registered as a panelist. Please ask your recruiter to add you to the panelist directory first.
                </div>
              )}

              {error && error !== 'unauthorized_recruiter' && (
                <div style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  color: '#ef4444',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ fontWeight: 700 }}>Authentication Error:</strong> {decodeURIComponent(error as string)}
                </div>
              )}

              <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-0.03em' }}>
                Automate Your <br />
                <span className="gradient-text" style={{ paddingBottom: '0.1em' }}>Interview Scheduling</span> <br />
                Inside Teams
              </h1>
              <p className="text-muted" style={{ fontSize: '1.05rem', marginBottom: '2.5rem', maxWidth: '500px', lineHeight: 1.6 }}>
                Stop chasing panels manually. Send request invites directly inside Teams, collect individual panel availabilities, calculate overlapping free slots, and book Teams online meetings instantly.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <a href="/api/auth/signin" className="btn btn-primary" style={{ padding: '0.9rem 2.25rem', display: 'inline-flex', alignItems: 'center' }}>
                  Recruiter Sign In
                </a>
                <a href="/api/auth/signin?role=panelist" className="btn btn-secondary" style={{ padding: '0.9rem 2.25rem', display: 'inline-flex', alignItems: 'center' }}>
                  Panelist Sign In
                </a>
              </div>
            </div>

            {/* Right Column: Isometric Capability Card */}
            <div className="perspective-hero">
              <div className="glass-card isometric-card" style={{ padding: '2.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', fontFamily: 'var(--font-heading)', color: 'var(--primary)' }}>
                  Product Capabilities
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }} className="group">
                    <div style={{
                      backgroundColor: 'rgba(26, 43, 74, 0.06)',
                      color: 'var(--primary)',
                      flexShrink: 0,
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(26, 43, 74, 0.05)',
                      transition: 'transform 0.2s'
                    }} className="hover-zoom">
                      <Users size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--primary)' }}>1. Search Tenant Directory</h4>
                      <p className="text-muted text-sm" style={{ lineHeight: 1.5 }}>Select panels directly from your organization via Microsoft Graph. No manual email copying needed.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }} className="group">
                    <div style={{
                      backgroundColor: 'rgba(0, 168, 120, 0.06)',
                      color: 'var(--success)',
                      flexShrink: 0,
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(0, 168, 120, 0.05)',
                      transition: 'transform 0.2s'
                    }} className="hover-zoom">
                      <Cpu size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--primary)' }}>2. MS Teams Notifications</h4>
                      <p className="text-muted text-sm" style={{ lineHeight: 1.5 }}>Nominated panels get an automated Teams chat card with a secure tokenized link to input their availability.</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }} className="group">
                    <div style={{
                      backgroundColor: 'rgba(70, 166, 132, 0.06)',
                      color: 'var(--accent-soft)',
                      flexShrink: 0,
                      width: '46px',
                      height: '46px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(70, 166, 132, 0.05)',
                      transition: 'transform 0.2s'
                    }} className="hover-zoom">
                      <Shield size={20} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', fontWeight: 700, color: 'var(--primary)' }}>3. Automatic Teams Booking</h4>
                      <p className="text-muted text-sm" style={{ lineHeight: 1.5 }}>Calculate overlapping availability automatically, select a slot, and generate the MS Teams meeting details.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-glass)', padding: '2rem 0', marginTop: 'auto', zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div className="container flex-between text-muted text-sm">
          <p>© 2026 PanelSync. Built securely with Next.js.</p>
          <div className="flex-gap-4">
            <span>Graph API v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

