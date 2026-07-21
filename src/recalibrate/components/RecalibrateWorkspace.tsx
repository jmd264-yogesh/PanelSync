'use client';

import React, { useEffect, useState } from 'react';
import {
  Wand2, Loader2, Download, AlertTriangle, Send, Undo2, CheckCircle2,
  Gauge, ListChecks, SlidersHorizontal, StickyNote, TrendingUp, TrendingDown, Minus, Pencil, ChevronDown,
  Clock3,
} from 'lucide-react';
import { ROLE_GRADES, CALIBRATION, STYLES } from '@server/services/ai/spec-catalog';
import type { RoleGrade, Style } from '@server/services/ai/spec-catalog';
import { ORG_TIER_LABEL, ORG_TIER_BAR, BEHAVIOURAL_EXPECTED_BAND } from '@server/services/ai/org-rubric';
import { useRecalibrateSession } from '@/recalibrate/hooks/useRecalibrateSession';
import { SectionHeader, ScoreDial, ProgressBar, ScoreLegend, RubricRow, DIFFICULTY_STYLE } from './primitives';
import type { CandidateStatus } from './CandidateRail';
import { InterviewStopwatch } from './InterviewStopwatch';

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

type TRecalibrateWorkspaceProps = {
  interviewId: string;
  candidateName: string;
  positionTitle: string;
  panelistName: string;
  onStatusChange?: (status: CandidateStatus) => void;
};

export const RecalibrateWorkspace = ({
  interviewId,
  candidateName,
  positionTitle,
  panelistName,
  onStatusChange,
}: TRecalibrateWorkspaceProps) => {
  const rc = useRecalibrateSession({ interviewId, candidateName, positionTitle, panelistName });
  const {
    loading, generating, submitting, error, session, activeRun, spec, setSpec, notes, setNotes,
    questionScores, rubricScores, isRunning, elapsedSeconds, elapsedLabel,
    handleGenerate, handleToggleSubmit, scoreQuestion, scoreRubric, handleNotesBlur,
    handleTimerStart, handleTimerPause, handleTimerResume, handleTimerReset: resetTimer,
    questions, orgTier, technicalDims, behaviouralDims,
    avgQuestionScore, scoredQuestionCount, avgRubricScore, ratedDimCount, allDims, gap, gapIsDiscrepant,
    handleDownloadCandidate, handleDownloadPanelist,
  } = rc;

  const [specExpanded, setSpecExpanded] = useState(true);

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
                  <button className="btn btn-primary" onClick={handleGenerate} disabled={generating} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    <span>{activeRun ? 'Regenerate Questions' : 'Generate Questions'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

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
                    </div>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.65rem', lineHeight: 1.55 }}>{q.question}</p>
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
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <SectionHeader icon={<Gauge size={14} />} title="Overall Scoring Rubric" />
              <ScoreLegend compact />
              <div className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.3rem 0 0' }}>Technical</div>
              {technicalDims.map((dim) => (
                <RubricRow key={dim.label} label={dim.label} bands={dim.bands} score={rubricScores[dim.label]} onScore={(n) => scoreRubric(dim.label, n)} dialSize={22} />
              ))}
              <div className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.5rem 0 0' }}>Behavioural</div>
              <div className="text-xs text-muted">Expected for {ORG_TIER_LABEL[orgTier]}: <strong>{BEHAVIOURAL_EXPECTED_BAND[orgTier]}</strong></div>
              {behaviouralDims.map((dim) => (
                <RubricRow key={dim.label} label={dim.label} bands={dim.bands} score={rubricScores[dim.label]} onScore={(n) => scoreRubric(dim.label, n)} dialSize={22} />
              ))}
            </div>
          </div>
        )}

        {/* Column 3 — Interview */}
        <div className="rc-interview-col">
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
                gapIsDiscrepant ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', padding: '0.5rem 0.6rem', fontSize: '0.72rem', borderRadius: '8px', borderLeft: '3px solid var(--danger, #ef4444)', background: 'var(--danger-glow, rgba(239,68,68,0.08))' }}>
                    <AlertTriangle size={12} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <span>{Math.abs(gap).toFixed(1)} pt gap — review before finalizing.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', padding: '0.5rem 0.6rem', fontSize: '0.72rem', borderRadius: '8px', borderLeft: '3px solid var(--success, #10b981)', background: 'var(--success-glow, rgba(16,185,129,0.08))' }}>
                    <CheckCircle2 size={12} style={{ marginTop: '1px', flexShrink: 0 }} />
                    <span>Scores consistent (gap under 1.0).</span>
                  </div>
                )
              )}
              <div className="text-xs text-muted">{scoredQuestionCount}/{questions.length} questions · {ratedDimCount}/{allDims.length} rubric dims</div>
            </div>

            {/* notes */}
            <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <SectionHeader icon={<StickyNote size={14} />} title="Notes" />
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
};