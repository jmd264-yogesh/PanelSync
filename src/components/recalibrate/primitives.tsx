'use client';

import React from 'react';

// Org rubric scale — 1 Does Not Meet .. 4 Exceeds Expectation. Shared visual language
// (color + labels) for every score control across Recalibrate, compact or full-page.
export const ORG_SCORE_LABELS: Record<number, string> = {
  1: 'Does Not Meet',
  2: 'Partially Meets',
  3: 'Meets Expectation',
  4: 'Exceeds Expectation',
};

export const SCORE_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#3b82f6',
  4: '#10b981',
};

export const DIFFICULTY_STYLE: Record<'easy' | 'medium' | 'hard', { bg: string; color: string }> = {
  easy: { bg: 'var(--success-glow, rgba(16,185,129,0.1))', color: 'var(--success, #10b981)' },
  medium: { bg: 'var(--warning-glow, rgba(245,158,11,0.1))', color: 'var(--warning, #f59e0b)' },
  hard: { bg: 'var(--danger-glow, rgba(239,68,68,0.1))', color: 'var(--danger, #ef4444)' },
};

export function SectionHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '24px', height: '24px', borderRadius: '7px',
          background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7',
        }}>
          {icon}
        </span>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{title}</h4>
      </div>
      {right}
    </div>
  );
}

export function ScoreDial({ value, selected, onSelect, size = 30 }: { value: number; selected: boolean; onSelect: () => void; size?: number }) {
  const color = SCORE_COLORS[value] || 'var(--primary)';
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${value} — ${ORG_SCORE_LABELS[value]}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        padding: 0,
        borderRadius: '50%',
        fontSize: size >= 30 ? '0.85rem' : '0.75rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'transform 0.12s ease, background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
        background: selected ? color : 'transparent',
        border: selected ? `1px solid ${color}` : '1px solid var(--border-glass)',
        color: selected ? '#fff' : 'var(--text-muted)',
        boxShadow: selected ? `0 3px 10px 0 ${color}4d` : 'none',
        transform: selected ? 'scale(1.06)' : 'scale(1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        if (!selected) { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = selected ? 'scale(1.06)' : 'scale(1)';
        if (!selected) { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-muted)'; }
      }}
    >
      {value}
    </button>
  );
}

export function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'var(--border-glass)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 'inherit', background: color, transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
    </div>
  );
}

export function ScoreLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', fontWeight: 600,
          padding: '0.2rem 0.5rem', borderRadius: '999px', background: `${SCORE_COLORS[n]}1a`, color: SCORE_COLORS[n],
        }}>
          <span>{n}</span>
          {!compact && <span>{ORG_SCORE_LABELS[n]}</span>}
        </span>
      ))}
    </div>
  );
}

export function RubricRow({
  label, bands, score, onScore, dialSize = 26,
}: {
  label: string;
  bands: readonly [string, string, string, string];
  score: number | undefined;
  onScore: (n: number) => void;
  dialSize?: number;
}) {
  const selectedBand = typeof score === 'number' ? bands[score - 1] : undefined;
  return (
    <div style={{ padding: '0.7rem 0', borderBottom: '1px solid var(--border-glass)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {[1, 2, 3, 4].map((n) => (
            <ScoreDial key={n} value={n} selected={score === n} onSelect={() => onScore(n)} size={dialSize} />
          ))}
        </div>
      </div>
      {selectedBand && (
        <div style={{
          marginTop: '0.4rem', display: 'flex', gap: '0.45rem', alignItems: 'flex-start',
          fontSize: '0.8rem', lineHeight: 1.5, padding: '0.4rem 0.55rem', borderRadius: '8px',
          background: `${SCORE_COLORS[score as number]}12`,
        }}>
          <span style={{ fontWeight: 700, color: SCORE_COLORS[score as number], flexShrink: 0 }}>{score}/4</span>
          <span>{selectedBand}</span>
        </div>
      )}
      <details style={{ marginTop: '0.35rem' }}>
        <summary style={{ fontSize: '0.74rem', cursor: 'pointer', color: 'var(--text-muted)' }}>View all bands</summary>
        <div style={{ marginTop: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {bands.map((text, i) => (
            <div key={i} style={{ fontSize: '0.76rem', display: 'flex', gap: '0.45rem', fontWeight: score === i + 1 ? 700 : 400 }}>
              <span style={{ minWidth: '1.1rem', color: SCORE_COLORS[i + 1] }}>{i + 1}</span>
              <span className={score === i + 1 ? undefined : 'text-muted'}>{text}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
