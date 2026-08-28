'use client';

import React, { useMemo, useState } from 'react';
import { Search, Users, Layers, CheckCircle2, ListChecks } from 'lucide-react';
import type { PanelistInterview } from '@/lib/db';
import CandidateGrid, { CandidateStatus, deriveRound } from './CandidateGrid';

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="glass-card" style={{ padding: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: '42px', height: '42px', borderRadius: '11px', background: `${accent}1a`, color: accent,
      }}>
        {icon}
      </span>
      <div>
        <div style={{ fontSize: '1.55rem', fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
        <div className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>{label}</div>
      </div>
    </div>
  );
}

// The landing screen for /recalibrate — every lateral interview assigned to this
// panelist, with an at-a-glance L1/L2 breakdown, before drilling into any one candidate.
export default function CandidateOverview({
  interviews, statuses, onSelect,
}: {
  interviews: PanelistInterview[];
  statuses: Record<string, CandidateStatus>;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    let l1 = 0;
    let l2 = 0;
    let submitted = 0;
    for (const i of interviews) {
      const round = deriveRound(i.role);
      if (round === 'L1') l1 += 1;
      else if (round === 'L2') l2 += 1;
      if (statuses[i.interviewId] === 'submitted') submitted += 1;
    }
    return { total: interviews.length, l1, l2, submitted };
  }, [interviews, statuses]);

  const filtered = useMemo(() => {
    if (!query.trim()) return interviews;
    const q = query.trim().toLowerCase();
    return interviews.filter((i) => i.candidateName.toLowerCase().includes(q) || i.role.toLowerCase().includes(q));
  }, [interviews, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      <div className="glass-card" style={{
        padding: '1.75rem 2rem', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--rc-brand-glow, rgba(124,58,237,0.1)) 0%, transparent 65%), var(--bg-card)',
      }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>Your candidates</h1>
        <p className="text-muted" style={{ margin: '0.3rem 0 0', fontSize: '0.88rem', maxWidth: '560px' }}>
          Every lateral hiring interview assigned to you, across both rounds. Select a candidate below to open their Recalibrate scorecard.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
        <StatTile icon={<Users size={18} />} label="Total assigned" value={counts.total} accent="var(--rc-brand, #7c3aed)" />
        <StatTile icon={<Layers size={18} />} label="L1 rounds" value={counts.l1} accent="var(--badge-l1-text, #0EA5E9)" />
        <StatTile icon={<Layers size={18} />} label="L2 rounds" value={counts.l2} accent="var(--badge-l2-text, #7c3aed)" />
        <StatTile icon={<CheckCircle2 size={18} />} label="Submitted" value={counts.submitted} accent="var(--success, #10b981)" />
      </div>

      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '26px', height: '26px', borderRadius: '8px',
              background: 'var(--rc-brand-glow, rgba(124,58,237,0.12))', color: 'var(--rc-brand, #7c3aed)',
            }}>
              <ListChecks size={14} />
            </span>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Candidates</h2>
          </div>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              placeholder="Search candidates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <CandidateGrid interviews={filtered} statuses={statuses} selectedId={null} onSelect={onSelect} />

        {interviews.length > 0 && interviews.length === filtered.length && (
          <p className="text-muted" style={{ margin: 0, fontSize: '0.78rem', textAlign: 'center' }}>
            That&apos;s everyone currently assigned to you — new candidates will show up here as recruiters schedule them.
          </p>
        )}
      </div>
    </div>
  );
}
