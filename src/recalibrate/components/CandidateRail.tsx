'use client';

import React from 'react';
import { Clock3, CircleDot, CheckCircle2 } from 'lucide-react';
import type { PanelistInterview } from '@server/lib/db';

export type CandidateStatus = 'not_started' | 'in_progress' | 'submitted';

const STATUS_META: Record<CandidateStatus, { label: string; color: string; icon: React.ComponentType<{ size?: number }> }> = {
  not_started: { label: 'Not started', color: 'var(--text-muted)', icon: CircleDot },
  in_progress: { label: 'In progress', color: 'var(--warning, #f59e0b)', icon: Clock3 },
  submitted: { label: 'Submitted', color: 'var(--success, #10b981)', icon: CheckCircle2 },
};

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

type TCandidateRailProps = {
  interviews: PanelistInterview[];
  statuses: Record<string, CandidateStatus>;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export const CandidateRail = ({
  interviews, statuses, selectedId, onSelect,
}: TCandidateRailProps) => {
  if (interviews.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
        <span className="text-muted text-xs">No matches.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {interviews.map((interview) => {
        const active = interview.interviewId === selectedId;
        const status = statuses[interview.interviewId] || 'not_started';
        const meta = STATUS_META[status];
        const Icon = meta.icon;
        const position = interview.role.replace(/^LATERAL - /i, '');

        return (
          <button
            key={interview.interviewId}
            type="button"
            onClick={() => onSelect(interview.interviewId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.65rem 0.75rem',
              borderRadius: '12px',
              border: active ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid var(--border-glass)',
              background: active ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-card)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'var(--transition-fast, all 0.15s ease)',
              width: '100%',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-card-hover)'; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-card)'; }}
          >
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '34px', height: '34px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 700,
              background: active ? 'linear-gradient(145deg, #a855f7, #7c3aed 70%)' : 'var(--border-glass)',
              color: active ? '#fff' : 'var(--text-muted)',
            }}>
              {initials(interview.candidateName)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.83rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {interview.candidateName}
              </div>
              <div className="text-muted" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {position}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem', color: meta.color }}>
                <Icon size={11} />
                <span style={{ fontSize: '0.66rem', fontWeight: 600 }}>{meta.label}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
