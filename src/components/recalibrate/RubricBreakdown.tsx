'use client';

import React from 'react';
import { ORG_TIER_LABEL } from '@/lib/ai/org-rubric';
import type { RubricBreakdown as Breakdown, RubricSectionResult } from '@/lib/ai/org-rubric';

// "How the score is calculated" — the rubric read the way the interview framework deck
// defines it: technical and case-study averages against the role bar of 3, behavioural
// against the role's expected band (the behavioural scale itself indicates seniority).

function fmt(v: number | null): string {
  return v === null ? '—' : v.toFixed(1);
}

function Verdict({ meets }: { meets: boolean | null }) {
  if (meets === null) return <span className="text-muted">not rated</span>;
  return (
    <span style={{ fontWeight: 700, color: meets ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)' }}>
      {meets ? 'Meets bar' : 'Below bar'}
    </span>
  );
}

function Row({ label, section, barText, extra }: { label: string; section: RubricSectionResult; barText: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', padding: '0.45rem 0', borderBottom: '1px solid var(--border-glass)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.78rem' }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmt(section.average)}<span className="text-muted" style={{ fontWeight: 500 }}>/4</span></span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.7rem' }}>
        <span className="text-muted">avg of {section.rated}/{section.total} rated · {barText}</span>
        <Verdict meets={section.meetsBar} />
      </div>
      {extra}
    </div>
  );
}

export default function RubricBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const { technical, caseStudy, behavioural, overall, tier } = breakdown;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
        Score breakdown — {ORG_TIER_LABEL[tier]}
      </div>
      <Row label="Technical" section={technical} barText="bar ≥ 3 (Meets Expectation)" />
      {caseStudy && <Row label="Technical Case Study" section={caseStudy} barText="bar ≥ 3 (compulsory)" />}
      <Row
        label="Behavioural"
        section={behavioural}
        barText={`expected band ${behavioural.expectedBand}`}
        extra={behavioural.indicatedSeniority && (
          <div className="text-xs text-muted" style={{ fontSize: '0.7rem' }}>
            Behavioural score indicates: <strong style={{ color: 'var(--text-main)' }}>{behavioural.indicatedSeniority}</strong>
          </div>
        )}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', padding: '0.45rem 0 0.2rem' }}>
        <span style={{ fontWeight: 700 }}>Overall rubric</span>
        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fmt(overall.average)}<span className="text-muted" style={{ fontWeight: 500 }}>/4</span></span>
      </div>
      <div className="text-xs text-muted" style={{ fontSize: '0.68rem', lineHeight: 1.5 }}>
        Each section is the plain average of its rated 1-4 rows (unrated rows are left out). Score 3 = the bar for this role.
        Behavioural uses one scale for every role: 1-2 = SSE, 2-3 = Enabler, 3-4 = Consultant &amp; above, 4 = exceeds even that.
      </div>
    </div>
  );
}
