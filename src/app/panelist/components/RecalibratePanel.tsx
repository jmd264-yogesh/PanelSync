'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Wand2, Loader2, Play, Square, Download, AlertTriangle } from 'lucide-react';
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
}

const DEFAULT_SPEC: Spec = {
  roleGrade: 'se',
  tracks: ['technical'],
  platforms: ['fabric'],
  topics: ['sql', 'modeling', 'pipeline'],
  style: 'practical',
  questionCount: 6,
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
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>{candidateName}</h3>
          <p className="text-muted text-sm" style={{ margin: 0 }}>{positionTitle}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div className="text-xs text-muted" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Elapsed</div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.1rem', fontWeight: 700 }}>{elapsedLabel}</div>
          </div>
          {!timerStartedAt || timerEndedAt ? (
            <button className="btn btn-sm" onClick={handleTimerStart} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <Play size={12} /> Start timer
            </button>
          ) : (
            <button className="btn btn-sm" onClick={handleTimerStop} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444' }}>
              <Square size={12} /> Stop timer
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#ef4444' }}>
          <AlertTriangle size={13} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Spec Inputs</h4>
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
        <div className="text-xs text-muted">{CALIBRATION[ROLE_GRADES[spec.roleGrade].tier]}</div>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Questions ({scoredQuestionCount}/{questions.length} scored)</h4>
          {questions.map((q, i) => (
            <div key={q.id} className="glass-card" style={{ padding: '0.75rem', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                <span className="badge">{i + 1}</span>
                <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>{q.category}</span>
                <span className="badge" style={{ fontSize: '0.62rem' }}>{q.difficulty}</span>
              </div>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.4rem' }}>{q.question}</p>
              <details style={{ marginBottom: '0.5rem' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => scoreQuestion(q.id, n)}
                    className="btn btn-sm"
                    style={{
                      width: '28px', height: '28px', padding: 0, borderRadius: '50%',
                      background: questionScores[q.id] === n ? 'var(--primary)' : 'transparent',
                      color: questionScores[q.id] === n ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Overall Scoring Rubric</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead>
                <tr>
                  <th>Skill Dimension</th>
                  {[1, 2, 3, 4, 5].map((n) => <th key={n} style={{ textAlign: 'center' }}>{n}</th>)}
                </tr>
              </thead>
              <tbody>
                {dims.map((dim) => (
                  <tr key={dim}>
                    <td>{dim}</td>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <td key={n} style={{ textAlign: 'center' }}>
                        <input
                          type="radio"
                          name={`rdim_${dim}`}
                          checked={rubricScores[dim] === n}
                          onChange={() => scoreRubric(dim, n)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span className="text-muted">Avg question score</span>
              <span style={{ fontFamily: 'monospace' }}>{avgQuestionScore !== null ? `${avgQuestionScore.toFixed(1)} / 5 (${scoredQuestionCount}/${questions.length} scored)` : '— not scored'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span className="text-muted">Avg rubric score</span>
              <span style={{ fontFamily: 'monospace' }}>{avgRubricScore !== null ? `${avgRubricScore.toFixed(1)} / 5 (${ratedDimCount} dims rated)` : '— not scored'}</span>
            </div>
            {gap !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span className="text-muted">Rubric vs question gap</span>
                <span style={{ fontFamily: 'monospace' }}>{(gap >= 0 ? '+' : '') + gap.toFixed(1)}</span>
              </div>
            )}
            {gap !== null && (
              Math.abs(gap) >= 1.0 ? (
                <div style={{ marginTop: '0.3rem', padding: '0.5rem 0.6rem', fontSize: '0.75rem', borderLeft: '3px solid #ef4444', background: 'rgba(239,68,68,0.08)' }}>
                  ⚠ Discrepancy: the rubric average is {Math.abs(gap).toFixed(1)} points {gap > 0 ? 'higher' : 'lower'} than the per-question average. Review before finalizing.
                </div>
              ) : (
                <div style={{ marginTop: '0.3rem', padding: '0.5rem 0.6rem', fontSize: '0.75rem', borderLeft: '3px solid #10b981', background: 'rgba(16,185,129,0.08)' }}>
                  ✓ Rubric and per-question scores are consistent (gap under 1.0).
                </div>
              )
            )}
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>Notes / overall recommendation</h4>
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
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
          <button className="btn btn-sm" onClick={handleDownloadCandidate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Download size={13} /> Download — Candidate sheet
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleDownloadPanelist} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Download size={13} /> Download — Panelist report
          </button>
        </div>
      )}
    </div>
  );
}
