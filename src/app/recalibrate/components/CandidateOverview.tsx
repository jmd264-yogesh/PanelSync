'use client';

import React, { useMemo, useState } from 'react';
import { Search, Users, Layers } from 'lucide-react';
import type { PanelistInterview } from '@/lib/db';
import CandidateGrid, { CandidateStatus, deriveRound } from './CandidateGrid';

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        width: '38px', height: '38px', borderRadius: '10px', background: `${accent}1a`, color: accent,
      }}>
        {icon}
      </span>
      <div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
        <div className="text-muted" style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.15rem' }}>{label}</div>
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
    for (const i of interviews) {
      const round = deriveRound(i.role);
      if (round === 'L1') l1 += 1;
      else if (round === 'L2') l2 += 1;
    }
    return { total: interviews.length, l1, l2 };
  }, [interviews]);

  const filtered = useMemo(() => {
    if (!query.trim()) return interviews;
    const q = query.trim().toLowerCase();
    return interviews.filter((i) => i.candidateName.toLowerCase().includes(q) || i.role.toLowerCase().includes(q));
  }, [interviews, query]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>Your candidates</h1>
        <p className="text-muted" style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Select a candidate below to score their lateral hiring interview.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', maxWidth: '620px' }}>
        <StatTile icon={<Users size={17} />} label="Total assigned" value={counts.total} accent="var(--rc-brand, #7c3aed)" />
        <StatTile icon={<Layers size={17} />} label="L1 rounds" value={counts.l1} accent="var(--badge-l1-text, #0EA5E9)" />
        <StatTile icon={<Layers size={17} />} label="L2 rounds" value={counts.l2} accent="var(--badge-l2-text, #7c3aed)" />
      </div>

      <div style={{ position: 'relative', maxWidth: '360px' }}>
        <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          className="form-input"
          style={{ paddingLeft: '2rem' }}
          placeholder="Search candidates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <CandidateGrid interviews={filtered} statuses={statuses} selectedId={null} onSelect={onSelect} />
    </div>
  );
}
