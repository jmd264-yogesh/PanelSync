'use client';

import React from 'react';
import { Clock3, CircleDot, CheckCircle2 } from 'lucide-react';
import type { PanelistInterview } from '@/lib/db';

export type CandidateStatus = 'not_started' | 'in_progress' | 'submitted';

export const STATUS_META: Record<CandidateStatus, { label: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
  not_started: { label: 'Not started', color: 'var(--text-muted)', icon: CircleDot },
  in_progress: { label: 'In progress', color: 'var(--warning, #f59e0b)', icon: Clock3 },
  submitted: { label: 'Submitted', color: 'var(--success, #10b981)', icon: CheckCircle2 },
};

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export function deriveRound(role: string): 'L1' | 'L2' | null {
  const roleLower = role.toLowerCase();
  return roleLower.includes('l2') ? 'L2' : roleLower.includes('l1') ? 'L1' : null;
}

export function positionLabel(role: string): string {
  return role.replace(/^(L1|L2)\s*-\s*/i, '').replace(/^LATERAL - /i, '');
}

// The candidate-selection surface for Recalibrate — a full-width grid of cards (this used
// to be a narrow always-visible sidebar; now it's the landing screen shown before a
// candidate is picked, so it gets the room to be a proper overview instead of a cramped list).
export default function CandidateGrid({
  interviews, statuses, selectedId, onSelect,
}: {
  interviews: PanelistInterview[];
  statuses: Record<string, CandidateStatus>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (interviews.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
        <span className="text-muted text-sm">No candidates match your search.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem' }}>
      {interviews.map((interview) => {
        const active = interview.interviewId === selectedId;
        const status = statuses[interview.interviewId] || 'not_started';
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        const round = deriveRound(interview.role);
        const position = positionLabel(interview.role);

        return (
          <button
            key={interview.interviewId}
            type="button"
            onClick={() => onSelect(interview.interviewId)}
            className="glass-card"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '1rem',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-fast, all 0.15s ease)',
              border: active ? '1px solid var(--rc-brand, #7c3aed)' : '1px solid var(--border-glass)',
              background: active ? 'var(--rc-brand-glow, rgba(124,58,237,0.08))' : 'var(--bg-card)',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-card)'; }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '42px', height: '42px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700,
              background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
            }}>
              {initials(interview.candidateName)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {interview.candidateName}
                </span>
                {round && (
                  <span style={{
                    fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', flexShrink: 0,
                    background: round === 'L1' ? 'var(--badge-l1-bg)' : 'var(--badge-l2-bg)',
                    color: round === 'L1' ? 'var(--badge-l1-text)' : 'var(--badge-l2-text)',
                    border: round === 'L1' ? '1px solid var(--badge-l1-border)' : '1px solid var(--badge-l2-border)',
                  }}>
                    {round}
                  </span>
                )}
              </div>
              <div className="text-muted" style={{ fontSize: '0.76rem', marginTop: '0.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {position}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.4rem', color: meta.color }}>
                <Icon size={12} />
                <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{meta.label}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
