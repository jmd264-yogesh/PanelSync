'use client';

import React from 'react';
import {
  Wand2, Loader2, Play, Square, Download, AlertTriangle, Send, Undo2, CheckCircle2,
  Gauge, ListChecks, SlidersHorizontal, StickyNote, TrendingUp, TrendingDown, Minus, Clock3,
} from 'lucide-react';
import { ROLE_GRADES, CALIBRATION, STYLES } from '@/lib/ai/spec-catalog';
import type { RoleGrade, Style } from '@/lib/ai/spec-catalog';
import { ORG_TIER_LABEL, ORG_TIER_BAR, BEHAVIOURAL_EXPECTED_BAND } from '@/lib/ai/org-rubric';
import { useRecalibrateSession } from '@/lib/recalibrate/useRecalibrateSession';
import { SectionHeader, ScoreDial, ProgressBar, ScoreLegend, RubricRow, DIFFICULTY_STYLE } from '@/components/recalibrate/primitives';

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
  const rc = useRecalibrateSession({ interviewId, candidateName, positionTitle, panelistName });
  const {
    loading, generating, submitting, error, session, activeRun, spec, setSpec, notes, setNotes,
    questionScores, rubricScores, isRunning, elapsedSeconds, elapsedLabel,
    handleGenerate, handleToggleSubmit, scoreQuestion, scoreRubric, handleNotesBlur, 
    handleTimerStart, handleTimerPause, handleTimerResume, handleTimerReset,
    questions, orgTier, technicalDims, behaviouralDims,
    avgQuestionScore, scoredQuestionCount, avgRubricScore, ratedDimCount, allDims, gap, gapIsDiscrepant,
    handleDownloadCandidate, handleDownloadPanelist,
  } = rc;

  const hasStarted = isRunning || elapsedSeconds > 0;

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
                className={isRunning ? 'animate-pulse' : undefined}
                style={{ width: '7px', height: '7px', borderRadius: '50%', background: isRunning ? 'var(--success, #10b981)' : 'var(--border-glass)' }}
              />
              <div className="text-xs text-muted" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Elapsed</div>
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 700 }}>{elapsedLabel}</div>
          </div>
          {!hasStarted ? (
            <button
              className="btn btn-sm"
              onClick={handleTimerStart}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                background: "var(--success-glow, rgba(16,185,129,0.1))",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "var(--success, #10b981)",
              }}
            >
              <Play size={12} /> Start timer
            </button>
          ) : isRunning ? (
            <button
              className="btn btn-sm"
              onClick={handleTimerPause}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                background: "var(--danger-glow, rgba(239,68,68,0.1))",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--danger, #ef4444)",
              }}
            >
              <Square size={12} /> Pause timer
            </button>
          ) : (
            <button
              className="btn btn-sm"
              onClick={handleTimerResume}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                background: "var(--success-glow, rgba(16,185,129,0.1))",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "var(--success, #10b981)",
              }}
            >
              <Play size={12} /> Resume timer
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
        <a href={`/recalibrate?interview=${interviewId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}>
          Open full Recalibrate workspace ↗
        </a>
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
        <div className="text-xs text-muted">
          Rubric: <strong style={{ color: 'var(--text-main)' }}>{ORG_TIER_LABEL[orgTier]}</strong> — bar: {ORG_TIER_BAR[orgTier]}
        </div>

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
                  <summary style={{ fontSize: '0.72rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Model rubric ({q.rubric.length} bands, out of {q.maxMarks})</summary>
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
                  {[1, 2, 3, 4].map((n) => (
                    <ScoreDial key={n} value={n} selected={questionScores[q.id] === n} onSelect={() => scoreQuestion(q.id, n)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', borderTop: '1px solid var(--border-glass)', paddingTop: '0.9rem' }}>
          <SectionHeader icon={<Gauge size={13} />} title="Overall Scoring Rubric" />
          <div className="text-xs text-muted">
            {ORG_TIER_LABEL[orgTier]} · bar: {ORG_TIER_BAR[orgTier]} · score 3 = the bar stated in the interview framework for this role
          </div>
          <ScoreLegend />

          <div>
            <div className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.4rem 0 0.2rem' }}>Technical Skill Rubric</div>
            {technicalDims.map((dim) => (
              <RubricRow key={dim.label} label={dim.label} bands={dim.bands} score={rubricScores[dim.label]} onScore={(n) => scoreRubric(dim.label, n)} />
            ))}
          </div>

          <div>
            <div className="text-xs" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0.6rem 0 0.2rem' }}>Behavioural Competency Rubric</div>
            <div className="text-xs text-muted" style={{ marginBottom: '0.3rem' }}>
              One shared scale across roles — reflects rough seniority, not the role being interviewed for. Expected range for {ORG_TIER_LABEL[orgTier]}: <strong>{BEHAVIOURAL_EXPECTED_BAND[orgTier]}</strong>.
            </div>
            {behaviouralDims.map((dim) => (
              <RubricRow key={dim.label} label={dim.label} bands={dim.bands} score={rubricScores[dim.label]} onScore={(n) => scoreRubric(dim.label, n)} />
            ))}
          </div>

          <div className="glass-card" style={{ padding: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Avg question score</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgQuestionScore !== null ? avgQuestionScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}> / 4</span></div>
                <div className="text-xs text-muted">{scoredQuestionCount}/{questions.length} scored</div>
              </div>
              <div>
                <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Avg rubric score</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>{avgRubricScore !== null ? avgRubricScore.toFixed(1) : '—'}<span className="text-xs text-muted" style={{ fontFamily: 'inherit', fontWeight: 500 }}> / 4</span></div>
                <div className="text-xs text-muted">{ratedDimCount}/{allDims.length} dims rated</div>
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
