'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Spec } from '@/lib/ai/schemas';
import type { RoleGrade } from '@/lib/ai/spec-catalog';
import { ROLE_GRADES, STYLES } from '@/lib/ai/spec-catalog';
import {
  getOrgTier, ORG_TIER_LABEL, TECHNICAL_CATEGORIES_BY_TIER, TECHNICAL_CATEGORY_LABEL,
  TECHNICAL_RUBRIC, BEHAVIOURAL_CATEGORIES, BEHAVIOURAL_CATEGORY_LABEL, BEHAVIOURAL_RUBRIC,
} from '@/lib/ai/org-rubric';
import { buildCandidateSheetHtml, buildPanelistReportHtml, printHtmlDocument } from '@/lib/pdf/recalibrate-print';

export interface RubricBand {
  band: string;
  description: string;
  exampleSignals: string[];
}

export interface RecalibrateQuestion {
  id: string;
  category: string;
  question: string;
  intent: string;
  linkedResumeEvidence: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  maxMarks: number;
  modelAnswer: string;
  rubric: RubricBand[];
  followUps: string[];
}

export interface QuestionSet {
  questions: RecalibrateQuestion[];
  totalMarks: number;
  coverageNotes: string;
}

export interface AiRun {
  id: string;
  interviewId: string;
  status: 'QUEUED' | 'PARSING' | 'EXTRACTING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  spec: Spec | null;
  questions: QuestionSet | null;
  createdAt: string;
}

export interface RecalibrateSession {
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

export interface RubricDim {
  label: string;
  bands: readonly [string, string, string, string];
}

const DEFAULT_SPEC: Spec = {
  roleGrade: 'se',
  style: 'practical',
  questionCount: 6,
  techStacks: [],
};

export function fmtElapsed(totalSeconds: number): string {
  // Guards against NaN/negative propagating into the displayed clock (e.g. a legacy
  // session whose timerEndedAt was stored as something non-numeric) — always renders a
  // real mm:ss instead of "NaN:NaN".
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

function avgOf(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// All Recalibrate data + business logic, used by the /recalibrate workspace
// (Lateral Hiring lives entirely there — see RecalibrateWorkspace.tsx).
export function useRecalibrateSession({
  interviewId, candidateName, positionTitle, panelistName,
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

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, setClockTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
          const parsedElapsed = loadedSession.timerEndedAt != null ? Number(loadedSession.timerEndedAt) : 0;
          setElapsedSeconds(Number.isFinite(parsedElapsed) ? parsedElapsed : 0);
          setStartedAt(loadedSession.timerStartedAt ? new Date(loadedSession.timerStartedAt).getTime() : null);
          setIsRunning(!!loadedSession.timerStartedAt);
        }
        if (chosenRun) {
          setActiveRun(chosenRun);
          // Runs generated before tech-stack selection existed have no `techStacks` in
          // their stored spec — normalize so every consumer can rely on it being an array.
          if (chosenRun.spec) setSpec({ ...chosenRun.spec, techStacks: chosenRun.spec.techStacks || [] });
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
    if (!isRunning) return;

    const id = setInterval(() => {
      setClockTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning]);

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
    // Belt-and-suspenders: the Generate/Regenerate button is already disabled in this
    // state, but guard here too so a stale render or programmatic call can't slip an
    // empty selection past the button and surface an opaque server-side "Invalid spec".
    if (!spec.techStacks || spec.techStacks.length === 0) {
      toast.error('Select at least one tech stack for this candidate before generating.');
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
      if (!res.ok) {
        // The server classifies failures (overload/rate-limit/timeout vs. a genuinely
        // unusable result) and marks the retryable ones, so the panelist is told whether
        // trying again is actually worth their time mid-interview.
        const base = result.details?.[0]?.message || result.error || 'Failed to generate questions.';
        throw new Error(result.retryable ? `${base} (Retrying usually works.)` : base);
      }
      setActiveRun(result);
      setQuestionScores({});
      setRubricScores({});
      await patchSession({ aiRunId: result.id, questionScores: {}, rubricScores: {} });
      toast.success('Questions and rubric generated.');

      // Start scoring the clock the moment questions are ready — resume rather than
      // reset if the panelist had already started (e.g. regenerating mid-interview),
      // so a regenerate never wipes out elapsed time.
      if (!isRunning) {
        if (elapsedSeconds > 0) handleTimerResume();
        else handleTimerStart();
      }
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

  // Lets the panelist re-weight a question's marks (e.g. worth more if it's the
  // candidate's specialty) without regenerating — persists via the same edit endpoint
  // AiCopilotPanel already uses for its own question edits. totalMarks is recomputed
  // server-side, never trusted from this client update.
  const updateQuestionMaxMarks = async (questionId: string, maxMarks: number) => {
    if (!activeRun?.questions) return;
    const nextQuestions: QuestionSet = {
      ...activeRun.questions,
      questions: activeRun.questions.questions.map((q) => (q.id === questionId ? { ...q, maxMarks } : q)),
    };
    setActiveRun({ ...activeRun, questions: nextQuestions });
    try {
      const res = await fetch(`/api/interviews/${interviewId}/ai-runs/${activeRun.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: nextQuestions }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to update marks.');
      setActiveRun(result);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update marks.');
    }
  };

  const handleTimerStart = () => {
    const now = Date.now();

    setElapsedSeconds(0);
    setStartedAt(now);
    setIsRunning(true);

    void patchSession({
      timerStartedAt: new Date(now).toISOString(),
      timerEndedAt: "0",
    });
  };

  const handleTimerPause = () => {
    if (!startedAt) return;

    const total =
      elapsedSeconds +
      Math.floor((Date.now() - startedAt) / 1000);

    setElapsedSeconds(total);
    setStartedAt(null);
    setIsRunning(false);

    void patchSession({
      timerStartedAt: null,
      timerEndedAt: String(total),
    });
  };

  const handleTimerResume = () => {
    if (isRunning) return;

    const now = Date.now();

    setStartedAt(now);
    setIsRunning(true);

    void patchSession({
      timerStartedAt: new Date(now).toISOString(),
      timerEndedAt: String(elapsedSeconds),
    });
  };

  const handleTimerReset = () => {
    setElapsedSeconds(0);
    setStartedAt(null);
    setIsRunning(false);

    void patchSession({
      timerStartedAt: null,
      timerEndedAt: "0",
    });
  };

  const questions = activeRun?.questions?.questions || [];
  const orgTier = useMemo(() => getOrgTier(spec.roleGrade), [spec.roleGrade]);

  // Only the tech stacks the panelist flagged as relevant to this candidate — falls back
  // to the full tier list when nothing's selected yet (e.g. before first generation) or
  // for runs generated before this selection existed.
  const technicalDims: RubricDim[] = useMemo(() => {
    const all = TECHNICAL_CATEGORIES_BY_TIER[orgTier];
    const selected = spec.techStacks && spec.techStacks.length > 0
      ? all.filter((id) => spec.techStacks.includes(id))
      : all;
    return selected.map((id) => ({
      label: TECHNICAL_CATEGORY_LABEL[id],
      bands: TECHNICAL_RUBRIC[orgTier][id]!,
    }));
  }, [orgTier, spec.techStacks]);
  const behaviouralDims: RubricDim[] = useMemo(() => BEHAVIOURAL_CATEGORIES.map((id) => ({
    label: BEHAVIOURAL_CATEGORY_LABEL[id],
    bands: BEHAVIOURAL_RUBRIC[id],
  })), []);
  const allDims: RubricDim[] = useMemo(() => [...technicalDims, ...behaviouralDims], [technicalDims, behaviouralDims]);

  const avgQuestionScore = useMemo(() => avgOf(questions.map((q) => questionScores[q.id]).filter((v): v is number => typeof v === 'number')), [questions, questionScores]);
  const scoredQuestionCount = questions.filter((q) => typeof questionScores[q.id] === 'number').length;
  const avgRubricScore = useMemo(() => avgOf(allDims.map((d) => rubricScores[d.label]).filter((v): v is number => typeof v === 'number')), [allDims, rubricScores]);
  const ratedDimCount = allDims.filter((d) => typeof rubricScores[d.label] === 'number').length;
  const gap = avgQuestionScore !== null && avgRubricScore !== null ? avgRubricScore - avgQuestionScore : null;
  const gapIsDiscrepant = gap !== null && Math.abs(gap) >= 1.0;

  // A question's "category" is the same string as its matching rubric dimension's label
  // (both technical and behavioural — see org-rubric.ts), so this groups scored questions
  // by category to get a per-dimension question average, comparable to that dimension's
  // rubric score. This is what actually explains a gap ("Snowflake rubric is a 4, but the
  // Snowflake questions only averaged 2.0") instead of just flagging that one exists.
  const avgQuestionScoreByCategory = useMemo(() => {
    const scoresByCategory: Record<string, number[]> = {};
    for (const q of questions) {
      const score = questionScores[q.id];
      if (typeof score !== 'number') continue;
      (scoresByCategory[q.category] ||= []).push(score);
    }
    const result: Record<string, number> = {};
    for (const category of Object.keys(scoresByCategory)) {
      result[category] = avgOf(scoresByCategory[category])!;
    }
    return result;
  }, [questions, questionScores]);

  // Every dimension with both a rubric score and at least one scored question in that
  // same category, ranked by how much it disagrees — the biggest contributors to `gap`.
  const dimensionGaps = useMemo(() => {
    return allDims
      .map((dim) => {
        const rubricScore = rubricScores[dim.label];
        const questionAvg = avgQuestionScoreByCategory[dim.label];
        if (typeof rubricScore !== 'number' || typeof questionAvg !== 'number') return null;
        return { label: dim.label, rubricScore, questionAvg, gap: rubricScore - questionAvg };
      })
      .filter((d): d is { label: string; rubricScore: number; questionAvg: number; gap: number } => d !== null)
      .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  }, [allDims, rubricScores, avgQuestionScoreByCategory]);

  const totalSeconds =
    elapsedSeconds +
    (isRunning && startedAt
      ? Math.floor((Date.now() - startedAt) / 1000)
      : 0);

  const elapsedLabel = fmtElapsed(totalSeconds);

  const buildPrintInput = () => ({
    candidateName,
    positionTitle,
    roleGradeLabel: ROLE_GRADES[spec.roleGrade].label,
    rubricTierLabel: ORG_TIER_LABEL[orgTier],
    styleLabel: STYLES[spec.style].label,
    panelistName,
    date: new Date().toISOString().slice(0, 10),
    questions: questions.map((q) => ({
      id: q.id, category: q.category, question: q.question, difficulty: q.difficulty, maxMarks: q.maxMarks,
      modelAnswer: q.modelAnswer,
      rubric: q.rubric.map((b) => ({ band: b.band, description: b.description })),
    })),
    questionScores,
    rubricDimensions: allDims.map((d) => d.label),
    rubricScores,
    notes,
    durationLabel: elapsedLabel,
  });

  const handleDownloadCandidate = () => printHtmlDocument(buildCandidateSheetHtml(buildPrintInput()));
  const handleDownloadPanelist = () => printHtmlDocument(buildPanelistReportHtml(buildPrintInput()));

  return {
    loading, generating, submitting, error,
    session, activeRun, spec, setSpec, notes, setNotes,
    questionScores, rubricScores,
    isRunning, startedAt, elapsedSeconds, elapsedLabel,
    handleGenerate, handleToggleSubmit, scoreQuestion, scoreRubric, handleNotesBlur, updateQuestionMaxMarks,
    handleTimerStart, handleTimerPause, handleTimerResume, handleTimerReset,
    questions, orgTier, technicalDims, behaviouralDims, allDims,
    avgQuestionScore, scoredQuestionCount, avgRubricScore, ratedDimCount, gap, gapIsDiscrepant, dimensionGaps,
    handleDownloadCandidate, handleDownloadPanelist,
  };
}
