'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Wand2, Loader2, Download, AlertTriangle, Send, Undo2, CheckCircle2,
  Gauge, ListChecks, SlidersHorizontal, StickyNote, TrendingUp, TrendingDown, Minus, Pencil, ChevronDown,
  Clock3, Sparkles, FileText, CheckCheck, Upload, Quote, RefreshCw, Eye, X, Check, Mic, Radio,
} from 'lucide-react';
import { ROLE_GRADES, CALIBRATION, STYLES } from '@/lib/ai/spec-catalog';
import type { RoleGrade, Style } from '@/lib/ai/spec-catalog';
import { ORG_TIER_LABEL, ORG_TIER_BAR, BEHAVIOURAL_EXPECTED_BAND, TECHNICAL_CATEGORIES_BY_TIER, TECHNICAL_CATEGORY_LABEL } from '@/lib/ai/org-rubric';
import { useRecalibrateSession } from '@/lib/recalibrate/useRecalibrateSession';
import type { QuestionEvaluation, TranscriptDialogueTurn } from '@/lib/db';
import { SectionHeader, ScoreDial, ProgressBar, ScoreLegend, RubricRow, DIFFICULTY_STYLE } from '@/components/recalibrate/primitives';
import type { CandidateStatus } from './CandidateGrid';
import InterviewStopwatch from './InterviewStopwatch';
import L1ReferencePanel from './L1ReferencePanel';
import TranscriptPanel from './TranscriptPanel';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

export default function RecalibrateWorkspace({
  interviewId,
  candidateName,
  positionTitle,
  panelistName,
  round = null,
  onStatusChange,
}: {
  interviewId: string;
  candidateName: string;
  positionTitle: string;
  panelistName: string;
  round?: 'L1' | 'L2' | null;
  onStatusChange?: (status: CandidateStatus) => void;
}) {
  const isL2Round = round === 'L2';
  const rc = useRecalibrateSession({ interviewId, candidateName, positionTitle, panelistName });
  const {
    loading, generating, submitting, error, session, activeRun, spec, setSpec, notes, setNotes,
    questionScores, rubricScores, appliedZeroQuestionIds, isRunning, elapsedSeconds, elapsedLabel,
    transcriptText, transcriptTurns, aiEvaluation, transcriptFetchedAt, transcriptSource, isProcessingTranscript,
    handleFetchTranscriptFromTeams, handleUploadTranscript, handleUploadAudio,
    handleAcceptAllAiScores, handleAcceptSingleQuestionScore, handleApplyAiSummaryToNotes,
    handleGenerate, handleToggleSubmit, scoreQuestion, scoreRubric, handleNotesBlur, updateQuestionMaxMarks,
    handleTimerStart, handleTimerPause, handleTimerResume, handleTimerReset: resetTimer,
    questions, orgTier, technicalDims, behaviouralDims,
    avgQuestionScore, scoredQuestionCount, avgRubricScore, ratedDimCount, allDims, gap, gapIsDiscrepant, dimensionGaps,
    handleDownloadCandidate, handleDownloadPanelist,
  } = rc;

  const [specExpanded, setSpecExpanded] = useState(true);

  const suggestedRubricScores = useMemo(() => {
    if (!aiEvaluation) return {};
    const result: Record<string, { score: number; reasoning?: string }> = {};

    const categoryScores: Record<string, number[]> = {};
    for (const qEval of aiEvaluation.questionEvaluations || []) {
      if (qEval.suggestedScore > 0) {
        const q = questions.find((item) => item.id === qEval.questionId);
        if (q && q.category) {
          (categoryScores[q.category] ||= []).push(qEval.suggestedScore);
        }
      }
    }

    for (const dim of allDims) {
      const label = dim.label;
      // 1. Direct match
      if (aiEvaluation.rubricEvaluations && aiEvaluation.rubricEvaluations[label]) {
        result[label] = {
          score: aiEvaluation.rubricEvaluations[label].suggestedScore,
          reasoning: aiEvaluation.rubricEvaluations[label].reasoning,
        };
        continue;
      }
      // 2. Question category match
      if (categoryScores[label] && categoryScores[label].length > 0) {
        const avg = Math.round(categoryScores[label].reduce((a, b) => a + b, 0) / categoryScores[label].length);
        result[label] = { score: Math.min(4, Math.max(1, avg)) };
        continue;
      }
      // 3. Normalized / Fuzzy match
      if (aiEvaluation.rubricEvaluations) {
        const target = label.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const [key, evalData] of Object.entries(aiEvaluation.rubricEvaluations)) {
          const normKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normKey === target || normKey.includes(target) || target.includes(normKey)) {
            result[label] = { score: evalData.suggestedScore, reasoning: evalData.reasoning };
            break;
          }
        }
        if (result[label]) continue;

        // 4. Aliases
        if (label === 'Logical Thinking & Problem Solving' && aiEvaluation.rubricEvaluations['Problem Solving']) {
          result[label] = {
            score: aiEvaluation.rubricEvaluations['Problem Solving'].suggestedScore,
            reasoning: aiEvaluation.rubricEvaluations['Problem Solving'].reasoning,
          };
          continue;
        } else if (label === 'Assertiveness & Comms' && (aiEvaluation.rubricEvaluations['Communication & Assertiveness'] || aiEvaluation.rubricEvaluations['Communication'])) {
          const comms = aiEvaluation.rubricEvaluations['Communication & Assertiveness'] || aiEvaluation.rubricEvaluations['Communication'];
          result[label] = { score: comms.suggestedScore, reasoning: comms.reasoning };
          continue;
        } else if (label === 'People Management' && (aiEvaluation.rubricEvaluations['People Management'] || aiEvaluation.rubricEvaluations['Leadership'])) {
          const people = aiEvaluation.rubricEvaluations['People Management'] || aiEvaluation.rubricEvaluations['Leadership'];
          result[label] = { score: people.suggestedScore, reasoning: people.reasoning };
          continue;
        }
      }

      // 5. Default to 0 for unaddressed or unevidenced dimension
      result[label] = {
        score: 0,
        reasoning: 'No transcript evidence or discussion for this dimension.',
      };
    }
    return result;
  }, [aiEvaluation, questions, allDims]);

  // A session "has started" once there's recorded elapsed time or it's actively running —
  // this covers the resumed-after-refresh case where isRunning is true but elapsedSeconds
  // may still be 0 for the first tick.
  const hasStarted = isRunning || elapsedSeconds > 0;

  const handleTimerReset = () => {
    if (!confirm('Reset interview timer?')) return;
    resetTimer();
  };

  useEffect(() => {
    if (activeRun && questions.length > 0) setSpecExpanded(false);
  }, [activeRun?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onStatusChange) return;
    if (session?.submittedAt) { onStatusChange('submitted'); return; }
    const hasProgress = Object.keys(questionScores).length > 0 || Object.keys(rubricScores).length > 0 || hasStarted;
    onStatusChange(hasProgress ? 'in_progress' : 'not_started');
  }, [session?.submittedAt, questionScores, rubricScores, hasStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', height: '96px' }} />
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div className="glass-card" style={{ flex: 1, padding: '1.5rem', height: '320px' }} />
          <div className="glass-card" style={{ width: '340px', padding: '1.5rem', height: '320px' }} />
          <div className="glass-card" style={{ width: '320px', padding: '1.5rem', height: '320px' }} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
        width: "100%",
        minHeight: "100vh",
        flex: 1,
      }}
    >
      <style>{`
        .rc-workspace-grid {
          display: grid;
          grid-template-columns:
            minmax(500px, 1fr)
            minmax(280px, 22%)
            minmax(280px, 20%);
          gap: 1.5rem;
          align-items: flex-start;
          width: 100%;
        }

        .rc-workspace-grid .rc-rubric-col,
        .rc-workspace-grid .rc-interview-col {
          position: sticky;
          top: 1.5rem;
          max-height: calc(100vh - 3rem);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          padding-bottom: 1rem;
        }

        @media (max-width: 1400px) {
          .rc-workspace-grid {
            grid-template-columns:
              minmax(0, 1fr)
              300px
              280px;
          }
        }

        @media (max-width: 1200px) {
          .rc-workspace-grid {
            grid-template-columns:
              minmax(0, 1fr)
              280px
              260px;
          }
        }

        @media (max-width: 1080px) {
          .rc-workspace-grid {
            display: flex;
            flex-direction: column;
          }

          .rc-workspace-grid .rc-rubric-col,
          .rc-workspace-grid .rc-interview-col {
            position: static;
            width: 100%;
            max-height: none;
          }
        }
      `}</style>

      {/* Hero header */}
      <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            width: '56px', height: '56px', borderRadius: '16px', fontSize: '1.1rem', fontWeight: 700,
            background: 'linear-gradient(145deg, #a855f7, #7c3aed 70%)', color: '#fff',
          }}>
            {initials(candidateName)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-heading)' }}>{candidateName}</h1>
            <p className="text-muted" style={{ margin: '0.1rem 0 0', fontSize: '0.9rem' }}>{positionTitle}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
              {round && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', fontSize: '0.72rem', fontWeight: 700,
                  padding: '0.2rem 0.55rem', borderRadius: '999px',
                  background: round === 'L1' ? 'var(--badge-l1-bg)' : 'var(--badge-l2-bg)',
                  color: round === 'L1' ? 'var(--badge-l1-text)' : 'var(--badge-l2-text)',
                  border: round === 'L1' ? '1px solid var(--badge-l1-border)' : '1px solid var(--badge-l2-border)',
                }}>
                  {round} Round
                </span>
              )}
              <span className="badge badge-info">{ROLE_GRADES[spec.roleGrade].label}</span>
              <span className="badge">{ORG_TIER_LABEL[orgTier]} rubric</span>
              {session?.submittedAt && (
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <CheckCircle2 size={11} /> Submitted
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--danger, #ef4444)' }}>
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      <div className="rc-workspace-grid">
        {/* Column 1 — Questions */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: questions.length > 0 ? 'pointer' : 'default' }}
              onClick={() => questions.length > 0 && setSpecExpanded((v) => !v)}
            >
              <SectionHeader icon={<SlidersHorizontal size={14} />} title="Spec Inputs" />
              {questions.length > 0 && (
                <ChevronDown size={16} style={{ transform: specExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', color: 'var(--text-muted)' }} />
              )}
            </div>

            {!specExpanded && questions.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span className="badge">{ROLE_GRADES[spec.roleGrade].label}</span>
                  <span className="badge">{STYLES[spec.style].label}</span>
                  <span className="badge">{spec.questionCount} questions</span>
                  <span className="badge">{spec.techStacks.length} tech stack{spec.techStacks.length === 1 ? '' : 's'}</span>
                </div>
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setSpecExpanded(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Pencil size={12} /> Edit
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.6rem' }}>
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
                <div className="text-xs text-muted">
                  Rubric: <strong style={{ color: 'var(--text-main)' }}>{ORG_TIER_LABEL[orgTier]}</strong> — bar: {ORG_TIER_BAR[orgTier]}
                </div>

                <div>
                  <div className="text-xs" style={{ fontWeight: 700, marginBottom: '0.4rem' }}>Tech stacks for this candidate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.4rem' }}>
                    {TECHNICAL_CATEGORIES_BY_TIER[orgTier].map((id) => {
                      const checked = spec.techStacks.includes(id);
                      return (
                        <label
                          key={id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', cursor: 'pointer',
                            padding: '0.4rem 0.55rem', borderRadius: 'var(--radius-md)',
                            border: checked ? '1px solid var(--rc-brand, #7c3aed)' : '1px solid var(--border-glass)',
                            background: checked ? 'var(--rc-brand-glow, rgba(124,58,237,0.08))' : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setSpec((s) => ({
                              ...s,
                              techStacks: e.target.checked ? [...s.techStacks, id] : s.techStacks.filter((t) => t !== id),
                            }))}
                          />
                          {TECHNICAL_CATEGORY_LABEL[id]}
                        </label>
                      );
                    })}
                  </div>
                  {spec.techStacks.length === 0 && (
                    <p className="text-xs" style={{ margin: '0.4rem 0 0', color: 'var(--warning, #f59e0b)' }}>Select at least one tech stack relevant to this candidate before generating.</p>
                  )}
                </div>

                <div>
                  <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || spec.techStacks.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    <span>{activeRun ? 'Regenerate Questions' : 'Generate Questions'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* AI Assessment Summary Banner (only when evaluation is available) */}
          {aiEvaluation && (
            <div className="glass-card" style={{
              padding: '1.15rem 1.35rem',
              borderRadius: '12px',
              background: 'rgba(124, 58, 237, 0.06)',
              border: '1px solid rgba(124, 58, 237, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Sparkles size={15} style={{ color: '#a855f7' }} />
                  <strong style={{ fontSize: '0.9rem', color: '#c084fc' }}>AI Calibration Assessment Ready</strong>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>
                    {aiEvaluation.confidence} confidence
                  </span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleAcceptAllAiScores}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem',
                    fontWeight: 700, padding: '0.35rem 0.85rem',
                    boxShadow: '0 0 16px rgba(124, 58, 237, 0.35)',
                  }}
                >
                  <CheckCheck size={14} />
                  <span>Apply All AI Scores & Notes</span>
                </button>
              </div>
              {aiEvaluation.overallSummary && (
                <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-main)' }}>
                  {aiEvaluation.overallSummary}
                </p>
              )}
            </div>
          )}

          {questions.length > 0 && (
            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <SectionHeader
                icon={<ListChecks size={14} />}
                title="Questions"
                right={<span className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>{scoredQuestionCount}/{questions.length} scored</span>}
              />
              <ProgressBar value={scoredQuestionCount} max={questions.length} color="var(--success, #10b981)" />
              {questions.map((q, i) => {
                const dStyle = DIFFICULTY_STYLE[q.difficulty];
                const qEval = aiEvaluation?.questionEvaluations?.find((e: QuestionEvaluation) => e.questionId === q.id);
                const isAiScoreApplied = qEval && (
                  qEval.suggestedScore > 0
                    ? questionScores[q.id] === qEval.suggestedScore
                    : (questionScores[q.id] === undefined && (appliedZeroQuestionIds?.has(q.id) ?? false))
                );
                return (
                  <div key={q.id} className="glass-card" style={{ padding: '1.1rem', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.6rem', alignItems: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '22px', height: '22px', borderRadius: '50%', fontSize: '0.7rem', fontWeight: 700,
                        background: 'var(--border-glass)', color: 'var(--text-muted)',
                      }}>
                        {i + 1}
                      </span>
                      <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>{q.category}</span>
                      <span className="badge" style={{ fontSize: '0.65rem', background: dStyle.bg, color: dStyle.color, border: 'none' }}>{q.difficulty}</span>

                      {/* AI Suggested Score Badge on Question Header */}
                      {qEval && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.2rem' }}>
                          <span
                            className="badge"
                            style={{
                              fontSize: '0.68rem', fontWeight: 700,
                              background: qEval.suggestedScore === 0 ? 'rgba(156, 163, 175, 0.12)' : 'rgba(124, 58, 237, 0.15)',
                              color: qEval.suggestedScore === 0 ? 'var(--text-muted)' : '#c084fc',
                              border: qEval.suggestedScore === 0 ? '1px solid rgba(156, 163, 175, 0.25)' : '1px solid rgba(124, 58, 237, 0.3)',
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            }}
                          >
                            <Sparkles size={10} />
                            AI Suggested: {qEval.suggestedScore}/4
                          </span>
                          {!isAiScoreApplied ? (
                            <button
                              className="btn btn-sm"
                              onClick={() => handleAcceptSingleQuestionScore(q.id, qEval.suggestedScore)}
                              style={{ padding: '0.15rem 0.45rem', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            >
                              <Check size={10} /> Apply
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: 'var(--success, #10b981)', display: 'inline-flex', alignItems: 'center', gap: '0.15rem' }}>
                              <Check size={10} /> Applied
                            </span>
                          )}
                        </div>
                      )}
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Marks
                        <input
                          key={q.maxMarks}
                          type="number" min={1} max={10}
                          className="form-input"
                          style={{ width: '3.2rem', padding: '0.15rem 0.35rem', fontSize: '0.72rem', textAlign: 'center' }}
                          defaultValue={q.maxMarks}
                          onBlur={(e) => {
                            const next = Math.min(10, Math.max(1, Number(e.target.value) || q.maxMarks));
                            if (next !== q.maxMarks) updateQuestionMaxMarks(q.id, next);
                          }}
                        />
                      </label>
                    </div>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.65rem', lineHeight: 1.55 }}>{q.question}</p>

                    {/* AI Transcript Evidence & Reasoning */}
                    {qEval && (
                      <details style={{ marginBottom: '0.65rem' }} open>
                        <summary style={{ fontSize: '0.75rem', cursor: 'pointer', color: '#c084fc', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Sparkles size={11} /> Candidate Response & Transcript Evidence
                        </summary>
                        <div style={{
                          marginTop: '0.45rem', padding: '0.65rem 0.8rem', borderRadius: '8px',
                          background: 'rgba(124, 58, 237, 0.04)', border: '1px solid rgba(124, 58, 237, 0.15)',
                          fontSize: '0.78rem', lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: '0.4rem',
                        }}>
                          <div>
                            <strong style={{ color: 'var(--text-main)' }}>Candidate's Answer: </strong>
                            <span>{qEval.candidateAnswerSummary}</span>
                          </div>

                          {qEval.verbatimQuote && (
                            <div style={{
                              padding: '0.4rem 0.6rem', borderLeft: '2px solid #a855f7',
                              background: 'rgba(124, 58, 237, 0.08)', fontStyle: 'italic',
                              borderRadius: '0 6px 6px 0', fontSize: '0.75rem',
                            }}>
                              "{qEval.verbatimQuote}"
                            </div>
                          )}

                          <div style={{ color: 'var(--text-muted)' }}>
                            <strong>AI Reasoning: </strong>
                            <span>{qEval.reasoning}</span>
                          </div>

                          {(qEval.strengths.length > 0 || qEval.gaps.length > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.2rem' }}>
                              {qEval.strengths.map((s: string, si: number) => (
                                <span key={si} className="badge badge-success" style={{ fontSize: '0.64rem' }}>+ {s}</span>
                              ))}
                              {qEval.gaps.map((g: string, gi: number) => (
                                <span key={gi} className="badge badge-danger" style={{ fontSize: '0.64rem' }}>- {g}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </details>
                    )}

                    {q.modelAnswer && (
                      <details style={{ marginBottom: '0.6rem' }}>
                        <summary style={{ fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Model answer guidance (panelist reference)</summary>
                        <p style={{
                          marginTop: '0.45rem', marginBottom: 0, fontSize: '0.82rem', lineHeight: 1.55,
                          padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-card-hover)', borderLeft: '3px solid var(--rc-brand, #7c3aed)',
                          whiteSpace: 'pre-wrap',
                        }}>
                          {q.modelAnswer}
                        </p>
                      </details>
                    )}
                    <details style={{ marginBottom: '0.7rem' }}>
                      <summary style={{ fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Model rubric ({q.rubric.length} bands, out of {q.maxMarks})</summary>
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {q.rubric.map((band, bi) => (
                          <div key={bi} style={{ fontSize: '0.76rem', display: 'flex', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, minWidth: '3.5rem' }}>{band.band}</span>
                            <span className="text-muted">{band.description}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</span>
                      {[1, 2, 3, 4].map((n) => (
                        <ScoreDial key={n} value={n} selected={questionScores[q.id] === n} onSelect={() => scoreQuestion(q.id, n)} size={32} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Column 2 — Rubric */}
        {questions.length > 0 && (
          <div className="rc-rubric-col">
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <SectionHeader icon={<Gauge size={14} />} title="Overall Scoring Rubric" />
                {aiEvaluation && (
                  <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(124, 58, 237, 0.12)', color: '#c084fc', border: 'none' }}>
                    <Sparkles size={9} style={{ display: 'inline', marginRight: '3px' }} />
                    AI Evaluated
                  </span>
                )}
              </div>
              <ScoreLegend compact />

              <div style={{
                borderLeft: '3px solid #a855f7', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.05)',
                padding: '0.75rem 0.9rem 0.15rem',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Technical</div>
                {technicalDims.map((dim) => (
                  <RubricRow
                    key={dim.label}
                    label={dim.label}
                    bands={dim.bands}
                    score={rubricScores[dim.label]}
                    suggestedScore={suggestedRubricScores[dim.label]?.score}
                    aiReasoning={suggestedRubricScores[dim.label]?.reasoning}
                    onScore={(n) => scoreRubric(dim.label, n)}
                    dialSize={22}
                  />
                ))}
              </div>

              <div style={{
                borderLeft: '3px solid var(--success, #10b981)', borderRadius: '10px', background: 'var(--success-glow, rgba(16,185,129,0.05))',
                padding: '0.75rem 0.9rem 0.15rem',
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success, #10b981)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Behavioural</div>
                <div className="text-xs text-muted" style={{ marginBottom: '0.3rem' }}>Expected for {ORG_TIER_LABEL[orgTier]}: <strong>{BEHAVIOURAL_EXPECTED_BAND[orgTier]}</strong></div>
                {behaviouralDims.map((dim) => (
                  <RubricRow
                    key={dim.label}
                    label={dim.label}
                    bands={dim.bands}
                    score={rubricScores[dim.label]}
                    suggestedScore={suggestedRubricScores[dim.label]?.score}
                    aiReasoning={suggestedRubricScores[dim.label]?.reasoning}
                    onScore={(n) => scoreRubric(dim.label, n)}
                    dialSize={22}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Column 3 — Interview */}
        <div className="rc-interview-col">
          {isL2Round && <L1ReferencePanel interviewId={interviewId} />}

          <TranscriptPanel
            interviewId={interviewId}
            candidateName={candidateName}
            roleTitle={positionTitle}
            transcriptText={transcriptText}
            transcriptTurns={transcriptTurns}
            aiEvaluation={aiEvaluation}
            transcriptFetchedAt={transcriptFetchedAt}
            transcriptSource={transcriptSource}
            isProcessingTranscript={isProcessingTranscript}
            onFetchFromTeams={handleFetchTranscriptFromTeams}
            onUploadTranscript={handleUploadTranscript}
            onUploadAudio={handleUploadAudio}
            onAcceptAllAiScores={handleAcceptAllAiScores}
            onAcceptSingleQuestionScore={handleAcceptSingleQuestionScore}
            onApplyAiSummaryToNotes={handleApplyAiSummaryToNotes}
            questions={questions}
          />

          <InterviewStopwatch
            elapsedLabel={elapsedLabel}
            isRunning={isRunning}
            hasStarted={hasStarted}
            onStart={hasStarted ? handleTimerResume : handleTimerStart}
            onPause={handleTimerPause}
            onReset={handleTimerReset}
          />

          {questions.length > 0 && (
            <>
              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <SectionHeader icon={<Gauge size={14} />} title="Live Analysis" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Avg question</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgQuestionScore !== null ? avgQuestionScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}>/4</span></div>
                </div>
                <div>
                  <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Avg rubric</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgRubricScore !== null ? avgRubricScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}>/4</span></div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>Rubric vs question gap</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'monospace', color: gap === null ? 'inherit' : gapIsDiscrepant ? 'var(--danger, #ef4444)' : 'var(--success, #10b981)' }}>
                  {gap !== null && (gap > 0 ? <TrendingUp size={15} /> : gap < 0 ? <TrendingDown size={15} /> : <Minus size={15} />)}
                  {gap !== null ? (gap >= 0 ? '+' : '') + gap.toFixed(1) : '—'}
                </div>
              </div>
              {gap !== null && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.5rem 0.6rem', fontSize: '0.72rem', borderRadius: '8px',
                  borderLeft: gapIsDiscrepant ? '3px solid var(--danger, #ef4444)' : '3px solid var(--success, #10b981)',
                  background: gapIsDiscrepant ? 'var(--danger-glow, rgba(239,68,68,0.08))' : 'var(--success-glow, rgba(16,185,129,0.08))',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                    {gapIsDiscrepant ? <AlertTriangle size={12} style={{ marginTop: '1px', flexShrink: 0 }} /> : <CheckCircle2 size={12} style={{ marginTop: '1px', flexShrink: 0 }} />}
                    <span>
                      {gapIsDiscrepant
                        ? `${Math.abs(gap).toFixed(1)} pt gap — review before finalizing.`
                        : 'Scores consistent (gap under 1.0).'}
                    </span>
                  </div>
                  {/* Always shown, regardless of whether the gap crosses the discrepancy
                      threshold — even a small gap is worth seeing where it comes from. */}
                  {dimensionGaps.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingLeft: '1.1rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.68rem' }}>By dimension (biggest disagreement first):</span>
                      {dimensionGaps.map((d) => (
                        <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.7rem' }}>
                          <span>{d.label}</span>
                          <span style={{ fontFamily: 'monospace', color: Math.abs(d.gap) >= 1.0 ? 'var(--danger, #ef4444)' : 'var(--text-muted)', flexShrink: 0 }}>
                            rubric {d.rubricScore} vs q&nbsp;avg {d.questionAvg.toFixed(1)} ({(d.gap >= 0 ? '+' : '') + d.gap.toFixed(1)})
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted" style={{ fontSize: '0.68rem', paddingLeft: '1.1rem' }}>
                      No dimension has both a rubric score and a scored question in the same category yet — score at least one question per rubric category to see what’s driving this.
                    </span>
                  )}
                </div>
              )}
              <div className="text-xs text-muted">{scoredQuestionCount}/{questions.length} questions · {ratedDimCount}/{allDims.length} rubric dims</div>
              {gap !== null && (scoredQuestionCount < questions.length || ratedDimCount < allDims.length) && (
                <div className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                  Based on partial scoring so far — this gap may shift as more questions/dimensions are scored.
                </div>
              )}
            </div>

            {/* notes */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <SectionHeader
                icon={<StickyNote size={14} />}
                title="Panel Notes"
                right={<span className="text-xs text-muted">Auto-saves</span>}
              />
              <textarea
                className="form-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Overall recommendation, standout moments, red flags..."
              />
            </div>

            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {session?.submittedAt ? (
                <div className="badge badge-success" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600, textTransform: 'none', fontSize: '0.7rem' }}>
                  <CheckCircle2 size={12} />
                  <span>Submitted {new Date(session.submittedAt).toLocaleString()}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <Clock3 size={12} />
                  <span>Not submitted — recruiters can't see this yet.</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={handleDownloadCandidate} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Download size={12} /> Candidate
                </button>
                <button className="btn btn-sm" onClick={handleDownloadPanelist} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Download size={12} /> Panelist
                </button>
              </div>
              {session?.submittedAt ? (
                <button className="btn btn-sm" onClick={handleToggleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                  <span>Withdraw submission</span>
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={handleToggleSubmit} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  <span>Submit to recruiters</span>
                </button>
              )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}