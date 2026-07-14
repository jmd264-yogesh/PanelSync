'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Wand2, Loader2, Play, Square, Download, AlertTriangle, Send, Undo2, CheckCircle2,
  Gauge, ListChecks, SlidersHorizontal, StickyNote, TrendingUp, TrendingDown, Minus, Clock3,
} from 'lucide-react';
import type { Spec } from '@/lib/ai/schemas';
import {
  ROLE_GRADES, CALIBRATION, TRACK_ORDER, TRACKS, STYLES, PLATFORMS, TOPICS, rubricDimensions,
} from '@/lib/ai/spec-catalog';
import type { RoleGrade, Platform, Topic, Style } from '@/lib/ai/spec-catalog';
import { SpecChip, toggleInArray } from './spec-ui';
import { buildCandidateSheetHtml, buildPanelistReportHtml, printHtmlDocument } from '@/lib/pdf/recalibrate-print';

interface RubricBand {
  band: string;
  description: string;
  exampleSignals: string[];
}

interface Question {
  id: string;
  category: string;
  question: string;
  intent: string;
  linkedResumeEvidence: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  maxMarks: number;
  rubric: RubricBand[];
  followUps: string[];
}

interface QuestionSet {
  questions: Question[];
  totalMarks: number;
  coverageNotes: string;
}

interface AiRun {
  id: string;
  interviewId: string;
  status: 'QUEUED' | 'PARSING' | 'EXTRACTING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  spec: Spec | null;
  questions: QuestionSet | null;
  createdAt: string;
}

interface RecalibrateSession {
  id: string;
  interviewId: string;
  aiRunId: string | null;
  questionScores: Record<string, number>;
  rubricScores: Record<string, number>;
  notes: string | null;
  timerStartedAt: string | null;
  timerEndedAt: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
}

const DEFAULT_SPEC: Spec = {
  roleGrade: 'se',
  tracks: ['technical'],
  platforms: ['fabric'],
  topics: ['sql', 'modeling', 'pipeline'],
  style: 'practical',
  questionCount: 6,
};

const SCORE_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f97316',
  3: '#f59e0b',
  4: '#84cc16',
  5: '#10b981',
};

const DIFFICULTY_STYLE: Record<Question['difficulty'], { bg: string; color: string }> = {
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

function SectionHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
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

function ScoreDial({ value, selected, onSelect, size = 30 }: { value: number; selected: boolean; onSelect: () => void; size?: number }) {
  const color = SCORE_COLORS[value] || 'var(--primary)';
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        padding: 0,
        borderRadius: '50%',
        fontSize: '0.8rem',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'var(--transition-fast, all 0.15s ease)',
        background: selected ? color : 'transparent',
        border: selected ? `1px solid ${color}` : '1px solid var(--border-glass)',
        color: selected ? '#fff' : 'var(--text-muted)',
        boxShadow: selected ? `0 2px 8px 0 ${color}55` : 'none',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = 'var(--border-glass)'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
    >
      {value}
    </button>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: 'var(--border-glass)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 'inherit', background: color, transition: 'width 0.4s ease-out' }} />
    </div>
  );
}

export default function RecalibratePanel({
  interviewId,
  candidateName,
  positionTitle,
  panelistName,
}: {
  interviewId: string;
  candidateName: string;
  positionTitle: string;
  panelistName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<RecalibrateSession | null>(null);
  const [activeRun, setActiveRun] = useState<AiRun | null>(null);
  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);

  const [questionScores, setQuestionScores] = useState<Record<string, number>>({});
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');

  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [timerEndedAt, setTimerEndedAt] = useState<string | null>(null);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [sessionRes, runsRes] = await Promise.all([
          fetch(`/api/interviews/${interviewId}/recalibrate`),
          fetch(`/api/interviews/${interviewId}/ai-runs`),
        ]);
        if (cancelled) return;

        let loadedSession: RecalibrateSession | null = null;
        let roleGrade: RoleGrade | null = null;
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          loadedSession = data.session;
          roleGrade = data.roleGrade;
        }

        let runs: AiRun[] = [];
        if (runsRes.ok) runs = await runsRes.json();

        const matched = loadedSession?.aiRunId ? runs.find((r) => r.id === loadedSession!.aiRunId) : null;
        const fallback = runs.find((r) => r.status === 'COMPLETED' && r.spec) || null;
        const chosenRun = matched || fallback;

        if (loadedSession) {
          setSession(loadedSession);
          setQuestionScores(loadedSession.questionScores || {});
          setRubricScores(loadedSession.rubricScores || {});
          setNotes(loadedSession.notes || '');
          setTimerStartedAt(loadedSession.timerStartedAt);
          setTimerEndedAt(loadedSession.timerEndedAt);
        }
        if (chosenRun) {
          setActiveRun(chosenRun);
          if (chosenRun.spec) setSpec(chosenRun.spec);
        } else if (roleGrade) {
          setSpec((s) => ({ ...s, roleGrade }));
        }
      } catch (err) {
        console.error('Failed to load Recalibrate session:', err);
        setError('Failed to load Recalibrate session.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [interviewId]);

  // Live elapsed-time tick while the timer is running.
  useEffect(() => {
    if (!timerStartedAt || timerEndedAt) return;
    const id = setInterval(() => setClockTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timerStartedAt, timerEndedAt]);

  const patchSession = async (patch: Partial<{
    aiRunId: string | null;
    questionScores: Record<string, number>;
    rubricScores: Record<string, number>;
    notes: string | null;
    timerStartedAt: string | null;
    timerEndedAt: string | null;
    submitted: boolean;
  }>) => {
    try {
      const res = await fetch(`/api/interviews/${interviewId}/recalibrate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) setSession(await res.json());
    } catch (err) {
      console.error('Failed to save Recalibrate session:', err);
    }
  };

  const handleGenerate = async () => {
    if (spec.tracks.includes('technical') && spec.topics.length === 0) {
      toast.error('Select at least one topic area.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/ai-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to generate questions.');
      setActiveRun(result);
      setQuestionScores({});
      setRubricScores({});
      await patchSession({ aiRunId: result.id, questionScores: {}, rubricScores: {} });
      toast.success('Questions and rubric generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions.');
      toast.error(err.message || 'Failed to generate questions.');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleSubmit = async () => {
    const nextSubmitted = !session?.submittedAt;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/recalibrate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submitted: nextSubmitted }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update submission status.');
      setSession(result);
      toast.success(nextSubmitted ? 'Assessment submitted — recruiters can now see it.' : 'Submission withdrawn.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update submission status.');
    } finally {
      setSubmitting(false);
    }
  };

  const scoreQuestion = (questionId: string, value: number) => {
    const next = { ...questionScores, [questionId]: value };
    setQuestionScores(next);
    void patchSession({ questionScores: next });
  };

  const scoreRubric = (dimension: string, value: number) => {
    const next = { ...rubricScores, [dimension]: value };
    setRubricScores(next);
    void patchSession({ rubricScores: next });
  };

  const handleNotesBlur = () => {
    void patchSession({ notes });
  };

  const handleTimerStart = () => {
    const now = new Date().toISOString();
    setTimerStartedAt(now);
    setTimerEndedAt(null);
    void patchSession({ timerStartedAt: now, timerEndedAt: null });
  };

  const handleTimerStop = () => {
    const now = new Date().toISOString();
    setTimerEndedAt(now);
    void patchSession({ timerEndedAt: now });
  };

  const questions = activeRun?.questions?.questions || [];
  const dims = useMemo(() => rubricDimensions(spec), [spec]);

  const avgQuestionScore = useMemo(() => avgOf(questions.map((q) => questionScores[q.id]).filter((v): v is number => typeof v === 'number')), [questions, questionScores]);
  const scoredQuestionCount = questions.filter((q) => typeof questionScores[q.id] === 'number').length;
  const avgRubricScore = useMemo(() => avgOf(dims.map((d) => rubricScores[d]).filter((v): v is number => typeof v === 'number')), [dims, rubricScores]);
  const ratedDimCount = dims.filter((d) => typeof rubricScores[d] === 'number').length;
  const gap = avgQuestionScore !== null && avgRubricScore !== null ? avgRubricScore - avgQuestionScore : null;
  const gapIsDiscrepant = gap !== null && Math.abs(gap) >= 1.0;
  const timerRunning = !!timerStartedAt && !timerEndedAt;

  const elapsedLabel = (() => {
    if (!timerStartedAt) return '—';
    const start = new Date(timerStartedAt).getTime();
    const end = timerEndedAt ? new Date(timerEndedAt).getTime() : Date.now();
    return fmt(Math.max(0, Math.floor((end - start) / 1000)));
  })();

  const buildPrintInput = () => ({
    candidateName,
    positionTitle,
    roleGradeLabel: ROLE_GRADES[spec.roleGrade].label,
    tracksLabel: TRACK_ORDER.filter((t) => spec.tracks.includes(t)).map((t) => TRACKS[t]).join(', '),
    styleLabel: STYLES[spec.style].label,
    panelistName,
    date: new Date().toISOString().slice(0, 10),
    questions: questions.map((q) => ({
      id: q.id, category: q.category, question: q.question, difficulty: q.difficulty, maxMarks: q.maxMarks,
      rubric: q.rubric.map((b) => ({ band: b.band, description: b.description })),
    })),
    questionScores,
    rubricDimensions: dims,
    rubricScores,
    notes,
    durationLabel: elapsedLabel,
  });

  const handleDownloadCandidate = () => printHtmlDocument(buildCandidateSheetHtml(buildPrintInput()));
  const handleDownloadPanelist = () => printHtmlDocument(buildPanelistReportHtml(buildPrintInput()));

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm text-muted">Loading Recalibrate session…</span>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
          }}>
            <Gauge size={18} />
          </span>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{candidateName}</h3>
            <p className="text-muted text-sm" style={{ margin: 0 }}>{positionTitle}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>
              <span
                className={timerRunning ? 'animate-pulse' : undefined}
                style={{ width: '7px', height: '7px', borderRadius: '50%', background: timerRunning ? 'var(--success, #10b981)' : 'var(--border-glass)' }}
              />
              <div className="text-xs text-muted" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Elapsed</div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700 }}>{elapsedLabel}</div>
          </div>
          {!timerStartedAt || timerEndedAt ? (
            <button
              className="btn btn-sm"
              onClick={handleTimerStart}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--success-glow, rgba(16,185,129,0.1))', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success, #10b981)' }}
            >
              <Play size={12} /> Start timer
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={handleTimerStop}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--danger-glow, rgba(239,68,68,0.1))', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger, #ef4444)' }}
            >
              <Square size={12} /> Stop timer
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--danger, #ef4444)' }}>
          <AlertTriangle size={13} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.9rem' }}>
        <SectionHeader icon={<SlidersHorizontal size={13} />} title="Spec Inputs" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
          <select className="form-input" value={spec.roleGrade} onChange={(e) => setSpec((s) => ({ ...s, roleGrade: e.target.value as RoleGrade }))}>
            {Object.entries(ROLE_GRADES).map(([key, r]) => <option key={key} value={key}>{r.label}</option>)}
          </select>
          <select className="form-input" value={spec.style} onChange={(e) => setSpec((s) => ({ ...s, style: e.target.value as Style }))}>
            {Object.entries(STYLES).map(([key, st]) => <option key={key} value={key}>{st.label}</option>)}
          </select>
          <input
            className="form-input" type="number" min={3} max={12}
            value={spec.questionCount}
            onChange={(e) => setSpec((s) => ({ ...s, questionCount: Number(e.target.value) }))}
          />
        </div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>{CALIBRATION[ROLE_GRADES[spec.roleGrade].tier]}</div>

        <div>
          <div className="text-xs" style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Interview tracks</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {TRACK_ORDER.map((t) => (
              <SpecChip key={t} active={spec.tracks.includes(t)} label={TRACKS[t]} onClick={() => setSpec((s) => ({ ...s, tracks: toggleInArray(s.tracks, t, true) }))} />
            ))}
          </div>
        </div>

        {spec.tracks.includes('technical') && (
          <>
            <div>
              <div className="text-xs" style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Platform focus</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {Object.entries(PLATFORMS).map(([key, label]) => (
                  <SpecChip key={key} active={spec.platforms.includes(key as Platform)} label={label} onClick={() => setSpec((s) => ({ ...s, platforms: toggleInArray(s.platforms, key as Platform) }))} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Topic areas</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {Object.entries(TOPICS).map(([key, label]) => (
                  <SpecChip key={key} active={spec.topics.includes(key as Topic)} label={label} onClick={() => setSpec((s) => ({ ...s, topics: toggleInArray(s.topics, key as Topic) }))} />
                ))}
              </div>
            </div>
          </>
        )}

        <div>
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            <span>{activeRun ? 'Regenerate Questions' : 'Generate Questions'}</span>
          </button>
        </div>
      </div>

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.9rem' }}>
          <SectionHeader
            icon={<ListChecks size={13} />}
            title="Questions"
            right={<span className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>{scoredQuestionCount}/{questions.length} scored</span>}
          />
          <ProgressBar value={scoredQuestionCount} max={questions.length} color="var(--success, #10b981)" />
          {questions.map((q, i) => {
            const dStyle = DIFFICULTY_STYLE[q.difficulty];
            return (
              <div key={q.id} className="glass-card" style={{ padding: '0.85rem', border: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '20px', height: '20px', borderRadius: '50%', fontSize: '0.68rem', fontWeight: 700,
                    background: 'var(--border-glass)', color: 'var(--text-muted)',
                  }}>
                    {i + 1}
                  </span>
                  <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>{q.category}</span>
                  <span className="badge" style={{ fontSize: '0.62rem', background: dStyle.bg, color: dStyle.color, border: 'none' }}>{q.difficulty}</span>
                </div>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem', lineHeight: 1.5 }}>{q.question}</p>
                <details style={{ marginBottom: '0.6rem' }}>
                  <summary style={{ fontSize: '0.72rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Rubric ({q.rubric.length} bands)</summary>
                  <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {q.rubric.map((band, bi) => (
                      <div key={bi} style={{ fontSize: '0.72rem', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, minWidth: '3.5rem' }}>{band.band}</span>
                        <span className="text-muted">{band.description}</span>
                      </div>
                    ))}
                  </div>
                </details>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <ScoreDial key={n} value={n} selected={questionScores[q.id] === n} onSelect={() => scoreQuestion(q.id, n)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.9rem' }}>
          <SectionHeader icon={<Gauge size={13} />} title="Overall Scoring Rubric" />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'separate', borderSpacing: '0 0.35rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Skill Dimension</th>
                  {[1, 2, 3, 4, 5].map((n) => <th key={n} style={{ textAlign: 'center', width: '40px' }} />)}
                </tr>
              </thead>
              <tbody>
                {dims.map((dim) => (
                  <tr key={dim}>
                    <td style={{ paddingRight: '0.75rem' }}>{dim}</td>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <td key={n} style={{ textAlign: 'center' }}>
                        <ScoreDial value={n} selected={rubricScores[dim] === n} onSelect={() => scoreRubric(dim, n)} size={26} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card" style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Avg question score</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgQuestionScore !== null ? avgQuestionScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}> / 5</span></div>
                <div className="text-xs text-muted">{scoredQuestionCount}/{questions.length} scored</div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Avg rubric score</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgRubricScore !== null ? avgRubricScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}> / 5</span></div>
                <div className="text-xs text-muted">{ratedDimCount} dims rated</div>
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
                  <span>Discrepancy: the rubric average is {Math.abs(gap).toFixed(1)} points {gap > 0 ? 'higher' : 'lower'} than the per-question average. Review before finalizing.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', padding: '0.55rem 0.7rem', fontSize: '0.75rem', borderRadius: '8px', borderLeft: '3px solid var(--success, #10b981)', background: 'var(--success-glow, rgba(16,185,129,0.08))' }}>
                  <CheckCircle2 size={13} style={{ marginTop: '1px', flexShrink: 0 }} />
                  <span>Rubric and per-question scores are consistent (gap under 1.0).</span>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.9rem' }}>
          <SectionHeader icon={<StickyNote size={13} />} title="Notes / overall recommendation" />
          <textarea
            className="form-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Overall recommendation, standout moments, red flags..."
          />
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.9rem' }}>
          {session?.submittedAt ? (
            <div className="badge badge-success" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, textTransform: 'none' }}>
              <CheckCircle2 size={13} />
              <span>Submitted{session.submittedBy ? ` by ${session.submittedBy}` : ''} on {new Date(session.submittedAt).toLocaleString()} — visible to recruiters</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <Clock3 size={13} />
              <span>Not submitted yet — recruiters can't see this assessment until you submit it.</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-sm" onClick={handleDownloadCandidate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={13} /> Candidate sheet
            </button>
            <button className="btn btn-sm" onClick={handleDownloadPanelist} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <Download size={13} /> Panelist report
            </button>
            {session?.submittedAt ? (
              <button className="btn btn-sm" onClick={handleToggleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                <span>Withdraw submission</span>
              </button>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={handleToggleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: 'auto' }}>
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                <span>Submit to recruiters</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
