'use client';

import React from 'react';
import { CheckCircle2, Loader2, Pause, Play, RotateCcw, Send, Undo2 } from 'lucide-react';

// One slim bar that replaces three separate cards (candidate header, interview timer,
// submit). It stays at the top while scrolling, so the three things a panelist needs
// during a live interview — who they are interviewing, the clock, and where they are —
// are always in view, and Submit is never buried under the question list.

interface SessionBarProps {
  candidateName: string;
  positionTitle: string;
  round: 'L1' | 'L2' | null;
  gradeLabel: string;
  elapsedLabel: string;
  isRunning: boolean;
  hasStarted: boolean;
  onStartTimer: () => void;
  onPauseTimer: () => void;
  onResetTimer: () => void;
  scoredQuestions: number;
  totalQuestions: number;
  ratedSkills: number;
  totalSkills: number;
  submittedAt: string | null;
  submitting: boolean;
  onToggleSubmit: () => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export default function SessionBar(props: SessionBarProps) {
  const {
    candidateName, positionTitle, round, gradeLabel, elapsedLabel, isRunning, hasStarted,
    onStartTimer, onPauseTimer, onResetTimer, scoredQuestions, totalQuestions, ratedSkills, totalSkills,
    submittedAt, submitting, onToggleSubmit,
  } = props;
  const hasQuestions = totalQuestions > 0;

  return (
    <div
      className="glass-card rc-session-bar"
      style={{
        position: 'sticky', top: '0.5rem', zIndex: 20, padding: '0.7rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem 1.25rem',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: '1 1 260px' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            width: '38px', height: '38px', borderRadius: '11px', fontSize: '0.85rem', fontWeight: 700,
            background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
          }}
        >
          {initials(candidateName)}
        </span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {candidateName}
          </h1>
          <div className="text-xs text-muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem 0.5rem', alignItems: 'center' }}>
            {round && <strong style={{ color: 'var(--text-main)' }}>{round}</strong>}
            <span>{gradeLabel}</span>
            <span aria-hidden="true">·</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>{positionTitle}</span>
          </div>
        </div>
      </div>

      {/* Interview clock — the single timer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} role="group" aria-label="Interview timer">
        <span style={{ fontFamily: 'monospace', fontSize: '1.15rem', fontWeight: 700, minWidth: '4.2ch', fontVariantNumeric: 'tabular-nums' }} aria-live="off">
          {elapsedLabel}
        </span>
        <button
          type="button"
          className="btn btn-sm"
          onClick={isRunning ? onPauseTimer : onStartTimer}
          aria-label={isRunning ? 'Pause interview timer' : hasStarted ? 'Resume interview timer' : 'Start interview timer'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
        >
          {isRunning ? <Pause size={13} /> : <Play size={13} />}
          <span>{isRunning ? 'Pause' : hasStarted ? 'Resume' : 'Start'}</span>
        </button>
        {hasStarted && !isRunning && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onResetTimer} aria-label="Reset interview timer" title="Reset timer">
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {hasQuestions && (
        <div className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          <strong style={{ color: 'var(--text-main)' }}>{scoredQuestions}/{totalQuestions}</strong> questions ·{' '}
          <strong style={{ color: 'var(--text-main)' }}>{ratedSkills}/{totalSkills}</strong> skills
        </div>
      )}

      {hasQuestions && (
        submittedAt ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textTransform: 'none' }}>
              <CheckCircle2 size={12} /> Submitted
            </span>
            <button type="button" className="btn btn-sm" onClick={onToggleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
              <span>Withdraw</span>
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary btn-sm" onClick={onToggleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            <span>Submit to recruiters</span>
          </button>
        )
      )}
    </div>
  );
}
