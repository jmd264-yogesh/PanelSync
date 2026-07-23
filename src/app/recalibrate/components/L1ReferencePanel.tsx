'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, ChevronDown, CheckCircle2 } from 'lucide-react';
import {
  getOrgTier, TECHNICAL_CATEGORIES_BY_TIER, TECHNICAL_CATEGORY_LABEL, TECHNICAL_RUBRIC,
  BEHAVIOURAL_CATEGORIES, BEHAVIOURAL_CATEGORY_LABEL, BEHAVIOURAL_RUBRIC,
} from '@/lib/ai/org-rubric';
import type { Spec } from '@/lib/ai/schemas';
import { SectionHeader } from '@/components/recalibrate/primitives';

interface L1Reference {
  candidateName: string;
  positionTitle: string;
  spec: Spec | null;
  questions: { questions: { id: string; question: string; category: string }[] } | null;
  session: {
    questionScores: Record<string, number>;
    rubricScores: Record<string, number>;
    notes: string | null;
    submittedAt: string | null;
    submittedBy: string | null;
  };
}

const SCORE_COLORS: Record<number, string> = { 1: '#ef4444', 2: '#f97316', 3: '#3b82f6', 4: '#10b981' };

function avgOf(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function ScoreChip({ value }: { value: number | undefined }) {
  if (typeof value !== 'number') return <span className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>—</span>;
  const color = SCORE_COLORS[value] || 'var(--primary)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '28px', height: '20px', padding: '0 0.35rem', borderRadius: '999px',
      fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace', background: `${color}1a`, color,
    }}>
      {value}/4
    </span>
  );
}

// Read-only, condensed L1-round summary shown to an L2 panelist scoring the same
// candidate — the lateral-hiring equivalent of campus hiring's "L1 Round Feedback
// Reference" block. Never rendered anywhere in an L1 round's own view.
export default function L1ReferencePanel({ interviewId }: { interviewId: string }) {
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<L1Reference | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/interviews/${interviewId}/recalibrate/l1-reference`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(json.error || 'Failed to load L1 reference.');
        else setData(json);
      } catch {
        if (!cancelled) setError('Failed to load L1 reference.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [interviewId]);

  const spec = data?.spec || null;
  const orgTier = useMemo(() => (spec ? getOrgTier(spec.roleGrade) : null), [spec]);
  const allDims = useMemo(() => {
    if (!orgTier) return [];
    const technical = TECHNICAL_CATEGORIES_BY_TIER[orgTier].map((id) => TECHNICAL_CATEGORY_LABEL[id]);
    const behavioural = BEHAVIOURAL_CATEGORIES.map((id) => BEHAVIOURAL_CATEGORY_LABEL[id]);
    return [...technical, ...behavioural];
  }, [orgTier]);

  const questions = data?.questions?.questions || [];
  const questionScores = data?.session.questionScores || {};
  const rubricScores = data?.session.rubricScores || {};
  const avgQuestionScore = avgOf(questions.map((q) => questionScores[q.id]).filter((v): v is number => typeof v === 'number'));
  const avgRubricScore = avgOf(allDims.map((d) => rubricScores[d]).filter((v): v is number => typeof v === 'number'));

  return (
    <div className="glass-card" style={{ padding: '1rem', border: '1px solid rgba(99,102,241,0.25)' }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <SectionHeader icon={<CheckCircle2 size={14} />} title="L1 Round Reference" />
        <ChevronDown size={16} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--text-muted)' }} />
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Loader2 size={13} className="animate-spin" />
              <span className="text-xs text-muted">Loading L1 assessment…</span>
            </div>
          )}
          {!loading && error && <div className="text-xs text-muted">{error}</div>}
          {!loading && data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div className="text-xs text-muted">
                Submitted{data.session.submittedBy ? ` by ${data.session.submittedBy}` : ''}
                {data.session.submittedAt ? ` on ${new Date(data.session.submittedAt).toLocaleString()}` : ''} — read-only
              </div>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg question</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgQuestionScore !== null ? avgQuestionScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit' }}>/4</span></div>
                </div>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg rubric</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgRubricScore !== null ? avgRubricScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit' }}>/4</span></div>
                </div>
              </div>
              {allDims.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {allDims.map((label) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.76rem' }}>
                      <span>{label}</span>
                      <ScoreChip value={rubricScores[label]} />
                    </div>
                  ))}
                </div>
              )}
              {data.session.notes && (
                <div>
                  <div className="text-xs" style={{ fontWeight: 700, marginBottom: '0.2rem' }}>Notes</div>
                  <p className="text-xs text-muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{data.session.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
