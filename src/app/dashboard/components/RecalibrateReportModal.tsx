'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X, Download, Gauge, ListChecks, StickyNote, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Clock3 } from 'lucide-react';
import { ROLE_GRADES, STYLES } from '@/lib/ai/spec-catalog';
import {
  getOrgTier, ORG_TIER_LABEL, TECHNICAL_CATEGORIES_BY_TIER, TECHNICAL_CATEGORY_LABEL, TECHNICAL_RUBRIC,
  BEHAVIOURAL_CATEGORIES, BEHAVIOURAL_CATEGORY_LABEL, BEHAVIOURAL_RUBRIC, BEHAVIOURAL_EXPECTED_BAND,
} from '@/lib/ai/org-rubric';
import type { Spec } from '@/lib/ai/schemas';
import { buildPanelistReportHtml, printHtmlDocument } from '@/lib/pdf/recalibrate-print';

interface RubricBand {
  band: string;
  description: string;
}

interface ReportQuestion {
  id: string;
  category: string;
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxMarks: number;
  rubric: RubricBand[];
}

interface RecalibrateReport {
  candidateName: string;
  positionTitle: string;
  spec: Spec | null;
  questions: { questions: ReportQuestion[] } | null;
  session: {
    questionScores: Record<string, number>;
    rubricScores: Record<string, number>;
    notes: string | null;
    timerStartedAt: string | null;
    timerEndedAt: string | null;
    submittedAt: string | null;
    submittedBy: string | null;
  };
}

const SCORE_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#3b82f6',
  4: '#10b981',
};

const DIFFICULTY_STYLE: Record<ReportQuestion['difficulty'], { bg: string; color: string }> = {
  easy: { bg: 'var(--success-glow, rgba(16,185,129,0.1))', color: 'var(--success, #10b981)' },
  medium: { bg: 'var(--warning-glow, rgba(245,158,11,0.1))', color: 'var(--warning, #f59e0b)' },
  hard: { bg: 'var(--danger-glow, rgba(239,68,68,0.1))', color: 'var(--danger, #ef4444)' },
};

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function avgOf(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '22px', height: '22px', borderRadius: '6px',
        background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7',
      }}>
        {icon}
      </span>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>{title}</h4>
    </div>
  );
}

function ScoreChip({ value }: { value: number | undefined }) {
  if (typeof value !== 'number') {
    return <span className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>—</span>;
  }
  const color = SCORE_COLORS[value] || 'var(--primary)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: '30px', height: '22px', padding: '0 0.4rem', borderRadius: '999px',
      fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace',
      background: `${color}1a`, color,
    }}>
      {value}/4
    </span>
  );
}

export default function RecalibrateReportModal({
  candidateId,
  onClose,
}: {
  candidateId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RecalibrateReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/lateral-candidates/${candidateId}/recalibrate`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || 'Failed to load Recalibrate report.');
        } else {
          setReport(data);
        }
      } catch (err) {
        if (!cancelled) setError('Failed to load Recalibrate report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [candidateId]);

  const questions = report?.questions?.questions || [];
  const spec = report?.spec || null;
  const orgTier = useMemo(() => (spec ? getOrgTier(spec.roleGrade) : null), [spec]);

  const technicalDims = useMemo(() => {
    if (!orgTier) return [];
    return TECHNICAL_CATEGORIES_BY_TIER[orgTier].map((id) => ({ label: TECHNICAL_CATEGORY_LABEL[id], bands: TECHNICAL_RUBRIC[orgTier][id]! }));
  }, [orgTier]);
  const behaviouralDims = useMemo(() => BEHAVIOURAL_CATEGORIES.map((id) => ({ label: BEHAVIOURAL_CATEGORY_LABEL[id], bands: BEHAVIOURAL_RUBRIC[id] })), []);
  const allDims = useMemo(() => [...technicalDims, ...behaviouralDims], [technicalDims, behaviouralDims]);

  const questionScores = report?.session.questionScores || {};
  const rubricScores = report?.session.rubricScores || {};

  const avgQuestionScore = avgOf(questions.map((q) => questionScores[q.id]).filter((v): v is number => typeof v === 'number'));
  const avgRubricScore = avgOf(allDims.map((d) => rubricScores[d.label]).filter((v): v is number => typeof v === 'number'));
  const gap = avgQuestionScore !== null && avgRubricScore !== null ? avgRubricScore - avgQuestionScore : null;
  const gapIsDiscrepant = gap !== null && Math.abs(gap) >= 1.0;

  const durationLabel = (() => {
    const s = report?.session;
    if (!s?.timerStartedAt) return '—';
    const start = new Date(s.timerStartedAt).getTime();
    const end = s.timerEndedAt ? new Date(s.timerEndedAt).getTime() : start;
    return fmt(Math.max(0, Math.floor((end - start) / 1000)));
  })();

  const handleDownload = () => {
    if (!report || !spec || !orgTier) return;
    const html = buildPanelistReportHtml({
      candidateName: report.candidateName,
      positionTitle: report.positionTitle,
      roleGradeLabel: ROLE_GRADES[spec.roleGrade].label,
      rubricTierLabel: ORG_TIER_LABEL[orgTier],
      styleLabel: STYLES[spec.style].label,
      panelistName: report.session.submittedBy || '—',
      date: new Date().toISOString().slice(0, 10),
      questions: questions.map((q) => ({ id: q.id, category: q.category, question: q.question, difficulty: q.difficulty, maxMarks: q.maxMarks, rubric: q.rubric })),
      questionScores,
      rubricDimensions: allDims.map((d) => d.label),
      rubricScores,
      notes: report.session.notes || '',
      durationLabel,
    });
    printHtmlDocument(html);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60 }}>
      <div className="glass-card" style={{ padding: '1.5rem', width: '640px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '34px', height: '34px', borderRadius: '9px',
              background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
            }}>
              <Gauge size={16} />
            </span>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Recalibrate Report</h3>
              {report && <p className="text-muted text-xs" style={{ margin: 0 }}>{report.candidateName} · {report.positionTitle}</p>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2rem 0', justifyContent: 'center' }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm text-muted">Loading…</span>
          </div>
        )}

        {!loading && error && (
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <span className="text-muted text-sm">{error}</span>
          </div>
        )}

        {!loading && report && spec && orgTier && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div className="badge badge-success" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, textTransform: 'none' }}>
              <CheckCircle2 size={13} />
              <span>
                Submitted{report.session.submittedBy ? ` by ${report.session.submittedBy}` : ''}
                {report.session.submittedAt ? ` on ${new Date(report.session.submittedAt).toLocaleString()}` : ''}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span className="badge badge-info">{ROLE_GRADES[spec.roleGrade].label}</span>
              <span className="badge">{ORG_TIER_LABEL[orgTier]} rubric</span>
              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Clock3 size={11} /> {durationLabel}</span>
            </div>

            <div className="glass-card" style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Avg question score</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgQuestionScore !== null ? avgQuestionScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}> / 4</span></div>
                </div>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Avg rubric score</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgRubricScore !== null ? avgRubricScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}> / 4</span></div>
                </div>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Rubric vs question gap</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace', color: gap === null ? 'inherit' : gapIsDiscrepant ? 'var(--danger, #ef4444)' : 'var(--success, #10b981)' }}>
                    {gap !== null && (gap > 0 ? <TrendingUp size={16} /> : gap < 0 ? <TrendingDown size={16} /> : <Minus size={16} />)}
                    {gap !== null ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : '—'}
                  </div>
                </div>
              </div>
              {gap !== null && (
                gapIsDiscrepant ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.55rem 0.7rem', fontSize: '0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--danger, #ef4444)', background: 'var(--danger-glow, rgba(239,68,68,0.08))' }}>
                    <AlertTriangle size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <span>Discrepancy: rubric average is {Math.abs(gap).toFixed(1)} points {gap > 0 ? 'higher' : 'lower'} than the per-question average.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.55rem 0.7rem', fontSize: '0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--success, #10b981)', background: 'var(--success-glow, rgba(16,185,129,0.08))' }}>
                    <CheckCircle2 size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <span>Rubric and per-question scores are consistent (gap under 1.0).</span>
                  </div>
                )
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <SectionHeader icon={<ListChecks size={13} />} title="Questions" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {questions.map((q, i) => {
                  const dStyle = DIFFICULTY_STYLE[q.difficulty];
                  return (
                    <div key={q.id} className="glass-card" style={{ padding: '0.65rem 0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, lineHeight: 1.5 }}>Q{i + 1}. {q.question}</span>
                        <ScoreChip value={questionScores[q.id]} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                        <span className="badge badge-info" style={{ fontSize: '0.6rem' }}>{q.category}</span>
                        <span className="badge" style={{ fontSize: '0.6rem', background: dStyle.bg, color: dStyle.color, border: 'none' }}>{q.difficulty}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {technicalDims.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <SectionHeader icon={<Gauge size={13} />} title="Technical Skill Rubric" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {technicalDims.map((dim) => (
                    <div key={dim.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                      <span>{dim.label}</span>
                      <ScoreChip value={rubricScores[dim.label]} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <SectionHeader icon={<Gauge size={13} />} title="Behavioural Competency Rubric" />
              <div className="text-xs text-muted">Expected range for {ORG_TIER_LABEL[orgTier]}: <strong>{BEHAVIOURAL_EXPECTED_BAND[orgTier]}</strong></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {behaviouralDims.map((dim) => (
                  <div key={dim.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <span>{dim.label}</span>
                    <ScoreChip value={rubricScores[dim.label]} />
                  </div>
                ))}
              </div>
            </div>

            {report.session.notes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <SectionHeader icon={<StickyNote size={13} />} title="Panelist notes" />
                <p className="text-sm text-muted" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{report.session.notes}</p>
              </div>
            )}

            <div>
              <button className="btn btn-primary btn-sm" onClick={handleDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Download size={13} /> Download report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
