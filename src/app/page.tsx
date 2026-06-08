export const dynamic = 'force-dynamic';

import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { Calendar, Shield, Cpu, Users } from 'lucide-react';

export default async function Home() {
  const session = await getSession();

  // If already authenticated, redirect to dashboard
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border-glass)', padding: '1.5rem 0' }}>
        <div className="container flex-between">
          <div className="flex-gap-4">
            <div style={{ backgroundColor: 'var(--primary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
              <Calendar size={22} color="#ffffff" />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
              MCP <span className="gradient-accent-text">Scheduler</span>
            </span>
          </div>
          <a href="/api/auth/signin" className="btn btn-secondary btn-sm">
            Recruiter Sign In
          </a>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '4rem 0' }}>
        <div className="container">
          <div className="grid-2" style={{ alignItems: 'center', gap: '4rem' }}>
            {/* Left Column: Title & Text */}
            <div>
              <div className="badge badge-info" style={{ marginBottom: '1.25rem' }}>
                Powered by Microsoft Graph API
              </div>
              <h1 style={{ fontSize: '3rem', lineHeight: 1.15, marginBottom: '1.5rem' }}>
                Automate Your <br />
                <span className="gradient-text">Interview Scheduling</span> <br />
                Inside Teams
              </h1>
              <p className="text-muted" style={{ fontSize: '1.05rem', marginBottom: '2.5rem', maxWidth: '500px', lineHeight: 1.6 }}>
                Stop chasing panels manually. Send request invites directly inside Teams, collect individual panel availabilities, calculate overlapping free slots, and book Teams online meetings instantly.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <a href="/api/auth/signin" className="btn btn-primary" style={{ padding: '0.9rem 2rem' }}>
                  Sign in with Microsoft Work Account
                </a>
              </div>
            </div>

            {/* Right Column: Cards info */}
            <div className="glass-card" style={{ padding: '2.5rem' }}>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '1.75rem', fontFamily: 'var(--font-heading)' }}>Product Capabilities</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--primary)', flexShrink: 0, padding: '0.25rem' }}>
                    <Users size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', fontWeight: 600 }}>1. Search Tenant Directory</h4>
                    <p className="text-muted text-sm">Select panels directly from your organization via Microsoft Graph. No manual email copying needed.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--secondary)', flexShrink: 0, padding: '0.25rem' }}>
                    <Cpu size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', fontWeight: 600 }}>2. MS Teams Notifications</h4>
                    <p className="text-muted text-sm">Nominated panels get an automated Teams chat card with a secure tokenized link to input their availability.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ color: 'var(--success)', flexShrink: 0, padding: '0.25rem' }}>
                    <Shield size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', fontWeight: 600 }}>3. Automatic Teams Booking</h4>
                    <p className="text-muted text-sm">Calculate overlapping availability automatically, select a slot, and generate the MS Teams meeting details.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-glass)', padding: '2rem 0', marginTop: 'auto' }}>
        <div className="container flex-between text-muted text-sm">
          <p>© 2026 Microsoft Teams Interview Scheduler. Built securely with Next.js.</p>
          <div className="flex-gap-4">
            <span>Graph API v1.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
