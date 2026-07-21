'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2, FileText, Wand2, History, Save, AlertTriangle } from 'lucide-react';
import type { Spec } from '@server/services/ai/schemas';
import { ROLE_GRADES, CALIBRATION, STYLES } from '@server/services/ai/spec-catalog';
import type { RoleGrade, Style } from '@server/services/ai/spec-catalog';
import { getOrgTier, ORG_TIER_LABEL, ORG_TIER_BAR } from '@server/services/ai/org-rubric';

interface ResumeDigestSkill {
  name: string;
  evidence: string;
  selfReportedLevel: string;
}

interface ResumeDigest {
  summary: string;
  yearsOfExperience: number | null;
  currentRole: string | null;
  skills: ResumeDigestSkill[];
  experience: { company: string; title: string; durationMonths: number | null; highlights: string[] }[];
  education: { institution: string; degree: string | null }[];
  redFlags: string[];
  claimsToVerify: string[];
}

interface Criteria {
  roleTitle: string;
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'principal';
  interviewType: 'technical' | 'behavioral' | 'system_design' | 'mixed';
  focusAreas: string[];
  difficulty: 'easy' | 'balanced' | 'hard';
  questionCount: number;
  customInstructions?: string;
}

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
  candidateId: string | null;
  triggeredByEmail: string;
  status: 'QUEUED' | 'PARSING' | 'EXTRACTING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  criteria: Criteria | null;
  spec: Spec | null;
  resumeDigest: ResumeDigest | null;
  questions: QuestionSet | null;
  model: string | null;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
}

const DEFAULT_CRITERIA: Criteria = {
  roleTitle: '',
  seniority: 'mid',
  interviewType: 'technical',
  focusAreas: [],
  difficulty: 'balanced',
  questionCount: 6,
};

const DEFAULT_SPEC: Spec = {
  roleGrade: 'se',
  style: 'practical',
  questionCount: 6,
};

type TAiCopilotPanelProps = {
  interviewId: string;
  defaultRoleTitle: string;
};

export const AiCopilotPanel = ({ interviewId, defaultRoleTitle }: TAiCopilotPanelProps) => {
  const [expanded, setExpanded] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const [runs, setRuns] = useState<AiRun[]>([]);
  const [activeRun, setActiveRun] = useState<AiRun | null>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [criteria, setCriteria] = useState<Criteria>({ ...DEFAULT_CRITERIA, roleTitle: defaultRoleTitle });
  const [focusAreasInput, setFocusAreasInput] = useState('');
  const [editableQuestions, setEditableQuestions] = useState<Question[] | null>(null);

  const [mode, setMode] = useState<'resume' | 'spec'>('resume');
  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);

  const isLatestRun = (run: AiRun | null) => !!run && runs[0]?.id === run.id;

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/interviews/${interviewId}/ai-runs`);
      if (!res.ok) return;
      const data: AiRun[] = await res.json();
      setRuns(data);
      const latestCompleted = data.find((r) => r.status === 'COMPLETED') || data[0] || null;
      if (latestCompleted) {
        setActiveRun(latestCompleted);
        if (latestCompleted.criteria) {
          setCriteria(latestCompleted.criteria);
          setFocusAreasInput(latestCompleted.criteria.focusAreas.join(', '));
          setMode('resume');
        } else if (latestCompleted.spec) {
          setSpec(latestCompleted.spec);
          setMode('spec');
        }
        if (latestCompleted.questions) setEditableQuestions(latestCompleted.questions.questions);
      }
    } catch (err) {
      console.error('Failed to load AI run history:', err);
    } finally {
      setLoadedHistory(true);
    }
  };

  const handleToggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loadedHistory) loadHistory();
  };

  const handleGenerateDigest = async () => {
    setLoadingDigest(true);
    setError(null);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/ai-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to generate resume digest.');
      setActiveRun(result);
      setRuns((prev) => [result, ...prev]);
      toast.success('Resume digest generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate resume digest.');
      toast.error(err.message || 'Failed to generate resume digest.');
    } finally {
      setLoadingDigest(false);
    }
  };

  const handleGenerateQuestions = async () => {
    const focusAreas = focusAreasInput.split(',').map((s) => s.trim()).filter(Boolean);
    if (!criteria.roleTitle.trim()) {
      toast.error('Role title is required.');
      return;
    }
    if (focusAreas.length === 0) {
      toast.error('Add at least one focus area.');
      return;
    }

    setLoadingQuestions(true);
    setError(null);
    try {
      const payloadCriteria: Criteria = { ...criteria, focusAreas };
      const res = await fetch(`/api/interviews/${interviewId}/ai-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: payloadCriteria }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to generate questions.');
      setActiveRun(result);
      setRuns((prev) => [result, ...prev]);
      setCriteria(payloadCriteria);
      setEditableQuestions(result.questions?.questions || null);
      toast.success('Questions and rubric generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions.');
      toast.error(err.message || 'Failed to generate questions.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleGenerateFromSpec = async () => {
    setLoadingQuestions(true);
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
      setRuns((prev) => [result, ...prev]);
      setEditableQuestions(result.questions?.questions || null);
      toast.success('Questions and rubric generated.');
    } catch (err: any) {
      setError(err.message || 'Failed to generate questions.');
      toast.error(err.message || 'Failed to generate questions.');
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleSaveQuestionEdits = async () => {
    if (!activeRun || !editableQuestions || !activeRun.questions) return;
    setSavingQuestions(true);
    try {
      const totalMarks = editableQuestions.reduce((sum, q) => sum + q.maxMarks, 0);
      const payload: QuestionSet = { ...activeRun.questions, questions: editableQuestions, totalMarks };
      const res = await fetch(`/api/interviews/${interviewId}/ai-runs/${activeRun.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: payload }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to save edits.');
      setActiveRun(result);
      setRuns((prev) => prev.map((r) => (r.id === result.id ? result : r)));
      toast.success('Edits saved.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save edits.');
    } finally {
      setSavingQuestions(false);
    }
  };

  const updateQuestionField = (index: number, patch: Partial<Question>) => {
    setEditableQuestions((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const digest = activeRun?.resumeDigest;

  return (
    <div style={{ margin: '0.75rem 0' }}>
      <button
        onClick={handleToggleExpand}
        style={{
          background: 'none',
          border: 'none',
          padding: '0.25rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          color: '#a855f7',
          cursor: 'pointer',
          fontSize: '0.78rem',
          fontWeight: 600,
        }}
      >
        <Sparkles size={13} />
        <span>AI Interview Copilot</span>
        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div
          className="glass-card"
          style={{ marginTop: '0.6rem', padding: '1rem', border: '1px solid rgba(168, 85, 247, 0.2)', display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'resume' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('resume')}
            >
              From Resume
            </button>
            <button
              type="button"
              className={`btn btn-sm ${mode === 'spec' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMode('spec')}
            >
              From Spec
            </button>
            {runs.length > 0 && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <History size={12} />
                {runs.length} run{runs.length !== 1 ? 's' : ''} in history
              </span>
            )}
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#ef4444' }}>
              <AlertTriangle size={13} />
              <span>{error}</span>
            </div>
          )}

          {mode === 'resume' && (
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <a
              href={`/api/interviews/${interviewId}/resume`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <FileText size={13} />
              <span>View Resume</span>
            </a>
            <button className="btn btn-primary btn-sm" onClick={handleGenerateDigest} disabled={loadingDigest} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              {loadingDigest ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
              <span>{digest ? 'Refresh Digest' : 'Generate Digest'}</span>
            </button>
          </div>
          )}

          {mode === 'resume' && digest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>Resume Digest</h4>
              <p className="text-muted text-sm" style={{ margin: 0 }}>{digest.summary}</p>
              <div className="text-xs text-muted">
                {digest.currentRole && <span>Current role: <strong>{digest.currentRole}</strong> · </span>}
                {digest.yearsOfExperience !== null && <span>{digest.yearsOfExperience} yrs experience</span>}
              </div>
              {digest.skills.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {digest.skills.map((s, i) => (
                    <span key={i} className="badge badge-info" title={s.evidence} style={{ fontSize: '0.65rem' }}>
                      {s.name}
                    </span>
                  ))}
                </div>
              )}
              {digest.claimsToVerify.length > 0 && (
                <div>
                  <div className="text-xs" style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Claims to probe:</div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {digest.claimsToVerify.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
              {digest.redFlags.length > 0 && (
                <div>
                  <div className="text-xs" style={{ fontWeight: 600, marginBottom: '0.2rem', color: '#f59e0b' }}>Flagged for review:</div>
                  <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {digest.redFlags.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {mode === 'resume' && digest && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>Interview Criteria</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                <input
                  className="form-input"
                  placeholder="Role title"
                  value={criteria.roleTitle}
                  onChange={(e) => setCriteria((c) => ({ ...c, roleTitle: e.target.value }))}
                />
                <select className="form-input" value={criteria.seniority} onChange={(e) => setCriteria((c) => ({ ...c, seniority: e.target.value as Criteria['seniority'] }))}>
                  {['junior', 'mid', 'senior', 'lead', 'principal'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <select className="form-input" value={criteria.interviewType} onChange={(e) => setCriteria((c) => ({ ...c, interviewType: e.target.value as Criteria['interviewType'] }))}>
                  {['technical', 'behavioral', 'system_design', 'mixed'].map((v) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
                </select>
                <select className="form-input" value={criteria.difficulty} onChange={(e) => setCriteria((c) => ({ ...c, difficulty: e.target.value as Criteria['difficulty'] }))}>
                  {['easy', 'balanced', 'hard'].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <input
                  className="form-input"
                  type="number"
                  min={3}
                  max={15}
                  value={criteria.questionCount}
                  onChange={(e) => setCriteria((c) => ({ ...c, questionCount: Number(e.target.value) }))}
                />
              </div>
              <input
                className="form-input"
                placeholder="Focus areas, comma-separated (e.g. SQL, data modelling, stakeholder mgmt)"
                value={focusAreasInput}
                onChange={(e) => setFocusAreasInput(e.target.value)}
              />
              <textarea
                className="form-input"
                placeholder="Custom instructions for the AI (optional)"
                rows={2}
                value={criteria.customInstructions || ''}
                onChange={(e) => setCriteria((c) => ({ ...c, customInstructions: e.target.value }))}
              />
              <div>
                <button className="btn btn-primary btn-sm" onClick={handleGenerateQuestions} disabled={loadingQuestions} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {loadingQuestions ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  <span>Generate Questions</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'spec' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>Spec-driven Question Generation</h4>
              <p className="text-xs text-muted" style={{ margin: 0 }}>
                No resume needed — pick a role grade and the organization's own technical + behavioural rubric scopes the question set automatically.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
                <select
                  className="form-input"
                  value={spec.roleGrade}
                  onChange={(e) => setSpec((s) => ({ ...s, roleGrade: e.target.value as RoleGrade }))}
                >
                  {Object.entries(ROLE_GRADES).map(([key, r]) => (
                    <option key={key} value={key}>{r.label}</option>
                  ))}
                </select>
                <select
                  className="form-input"
                  value={spec.style}
                  onChange={(e) => setSpec((s) => ({ ...s, style: e.target.value as Style }))}
                >
                  {Object.entries(STYLES).map(([key, st]) => (
                    <option key={key} value={key}>{st.label}</option>
                  ))}
                </select>
                <input
                  className="form-input"
                  type="number"
                  min={3}
                  max={12}
                  value={spec.questionCount}
                  onChange={(e) => setSpec((s) => ({ ...s, questionCount: Number(e.target.value) }))}
                />
              </div>
              <div className="text-xs text-muted">{CALIBRATION[ROLE_GRADES[spec.roleGrade].tier]}</div>
              <div className="text-xs text-muted">{STYLES[spec.style].hint}</div>
              <div className="text-xs text-muted">
                Rubric: <strong style={{ color: 'var(--text-main)' }}>{ORG_TIER_LABEL[getOrgTier(spec.roleGrade)]}</strong> — bar: {ORG_TIER_BAR[getOrgTier(spec.roleGrade)]}
              </div>

              <div>
                <button className="btn btn-primary btn-sm" onClick={handleGenerateFromSpec} disabled={loadingQuestions} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  {loadingQuestions ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  <span>Generate Questions</span>
                </button>
              </div>
            </div>
          )}

          {editableQuestions && activeRun?.questions && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>
                  Questions &amp; Rubric ({editableQuestions.reduce((s, q) => s + q.maxMarks, 0)} marks total)
                </h4>
                {isLatestRun(activeRun) && (
                  <button className="btn btn-sm" onClick={handleSaveQuestionEdits} disabled={savingQuestions} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    {savingQuestions ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    <span>Save Edits</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-muted" style={{ margin: 0 }}>{activeRun.questions.coverageNotes}</p>

              {editableQuestions.map((q, i) => (
                <div key={q.id} className="glass-card" style={{ padding: '0.75rem', border: '1px solid var(--border-glass)' }}>
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                    <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>{q.category}</span>
                    <span className="badge" style={{ fontSize: '0.62rem' }}>{q.difficulty}</span>
                    <span className="badge" style={{ fontSize: '0.62rem' }}>{q.maxMarks} marks</span>
                  </div>
                  <textarea
                    className="form-input"
                    rows={2}
                    value={q.question}
                    disabled={!isLatestRun(activeRun)}
                    onChange={(e) => updateQuestionField(i, { question: e.target.value })}
                    style={{ marginBottom: '0.4rem' }}
                  />
                  <div className="text-xs text-muted" style={{ marginBottom: '0.3rem' }}>
                    <strong>Why:</strong> {q.intent}
                    {q.linkedResumeEvidence && <span> — linked to: {q.linkedResumeEvidence}</span>}
                  </div>
                  <details>
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
                  {q.followUps.length > 0 && (
                    <div className="text-xs text-muted" style={{ marginTop: '0.3rem' }}>
                      Follow-ups: {q.followUps.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
