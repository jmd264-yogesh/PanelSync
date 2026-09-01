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
import type { RecalibrateSession, AiTranscriptEvaluation, TranscriptDialogueTurn } from '@/lib/db';

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
  spec?: Spec | null;
  questions?: QuestionSet | null;
  model?: string | null;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
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

  // Meeting Transcript and AI Evaluation state
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptTurns, setTranscriptTurns] = useState<TranscriptDialogueTurn[] | null>(null);
  const [aiEvaluation, setAiEvaluation] = useState<AiTranscriptEvaluation | null>(null);
  const [transcriptFetchedAt, setTranscriptFetchedAt] = useState<string | null>(null);
  const [transcriptSource, setTranscriptSource] = useState<string | null>(null);
  const [isProcessingTranscript, setIsProcessingTranscript] = useState(false);

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
          setTranscriptText(loadedSession.transcriptText || null);
          setTranscriptTurns(loadedSession.transcriptTurns || null);
          setAiEvaluation(loadedSession.aiEvaluation || null);
          setTranscriptFetchedAt(loadedSession.transcriptFetchedAt || null);
          setTranscriptSource(loadedSession.transcriptSource || null);
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
    aiEvaluation: AiTranscriptEvaluation | null;
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
      setAiEvaluation(null);
      await patchSession({
        aiRunId: result.id,
        questionScores: {},
        rubricScores: {},
        aiEvaluation: null,
      });
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

  const handleFetchTranscriptFromTeams = async () => {
    setIsProcessingTranscript(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'graph' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch transcript from Teams.');

      if (data.session) {
        setSession(data.session);
        setTranscriptText(data.session.transcriptText || null);
        setTranscriptTurns(data.session.transcriptTurns || null);
        if (data.session.aiEvaluation) {
          setAiEvaluation(data.session.aiEvaluation);
        }
        setTranscriptFetchedAt(data.session.transcriptFetchedAt || null);
        setTranscriptSource(data.session.transcriptSource || 'graph_api');
      }
      if (data.evaluation) {
        setAiEvaluation(data.evaluation);
        toast.success('Teams transcript fetched and AI evaluation complete!');
      } else {
        toast.success('Teams transcript saved.');
      }
    } catch (err: any) {
      console.error('Error fetching Teams transcript:', err);
      toast.error(err.message || 'Failed to fetch transcript from Teams.');
    } finally {
      setIsProcessingTranscript(false);
    }
  };

  const handleUploadTranscript = async (rawTranscript: string) => {
    if (!rawTranscript || !rawTranscript.trim()) {
      toast.error('Please enter or upload a non-empty transcript.');
      return;
    }
    setIsProcessingTranscript(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'manual', rawTranscript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process transcript.');

      if (data.session) {
        setSession(data.session);
        setTranscriptText(data.session.transcriptText || null);
        setTranscriptTurns(data.session.transcriptTurns || null);
        if (data.session.aiEvaluation) {
          setAiEvaluation(data.session.aiEvaluation);
        }
        setTranscriptFetchedAt(data.session.transcriptFetchedAt || null);
        setTranscriptSource(data.session.transcriptSource || 'manual_upload');
      }
      if (data.evaluation) {
        setAiEvaluation(data.evaluation);
        toast.success('Transcript uploaded and AI evaluation complete!');
      } else {
        toast.success('Transcript uploaded successfully.');
      }
    } catch (err: any) {
      console.error('Error uploading transcript:', err);
      toast.error(err.message || 'Failed to upload transcript.');
    } finally {
      setIsProcessingTranscript(false);
    }
  };

  const handleUploadAudio = async (
    audioOrAudios: string | Array<{ audioBase64: string; mimeType: string }>,
    mimeTypeOrSourceType?: string,
    sourceTypeParam: 'live_recording' | 'audio_upload' = 'audio_upload',
  ) => {
    setIsProcessingTranscript(true);
    try {
      const body: any = { source: 'audio' };
      if (Array.isArray(audioOrAudios)) {
        body.audios = audioOrAudios;
        body.sourceType = (mimeTypeOrSourceType as 'live_recording' | 'audio_upload') || 'live_recording';
      } else {
        body.audioBase64 = audioOrAudios;
        body.mimeType = mimeTypeOrSourceType || 'audio/webm';
        body.sourceType = sourceTypeParam;
      }

      const res = await fetch(`/api/interviews/${interviewId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        if (res.status === 404) {
          throw new Error('Interview transcript endpoint not found (404). Please ensure PanelSync dev server is running on port 3000.');
        }
        if (res.status === 413) {
          throw new Error('Audio payload is too large for the server. Try recording a shorter clip.');
        }
        if (res.status === 401 || res.status === 403) {
          throw new Error('Your session has expired. Please sign in again.');
        }
        throw new Error(`Server returned HTTP ${res.status}: ${text.slice(0, 100)}`);
      }

      if (!res.ok) throw new Error(data.error || 'Failed to transcribe and evaluate audio.');

      if (data.session) {
        setSession(data.session);
        setTranscriptText(data.session.transcriptText || null);
        setTranscriptTurns(data.session.transcriptTurns || null);
        if (data.session.aiEvaluation) {
          setAiEvaluation(data.session.aiEvaluation);
        }
        setTranscriptFetchedAt(data.session.transcriptFetchedAt || null);
        setTranscriptSource(data.session.transcriptSource || body.sourceType);
      }
      if (data.evaluation) {
        setAiEvaluation(data.evaluation);
        toast.success(
          body.sourceType === 'live_recording'
            ? 'Live recording(s) transcribed and AI evaluation complete!'
            : 'Audio(s) transcribed and AI evaluation complete!',
        );
      } else if (data.session?.aiEvaluation) {
        toast.success('Audio transcribed and AI evaluation updated!');
      } else {
        toast.success('Audio transcribed successfully.');
      }
    } catch (err: any) {
      console.error('Error processing audio:', err);
      toast.error(err.message || 'Failed to process audio recording.');
    } finally {
      setIsProcessingTranscript(false);
    }
  };

  const handleAcceptAllAiScores = async () => {
    if (!aiEvaluation) {
      toast.error('No AI evaluation available to apply.');
      return;
    }

    // 1. Map Question Scores
    const nextQuestionScores: Record<string, number> = { ...questionScores };
    for (const qEval of aiEvaluation.questionEvaluations) {
      nextQuestionScores[qEval.questionId] = qEval.suggestedScore;
    }

    // 2. Map Rubric Scores (matching exact, question categories, normalized, and aliases)
    const nextRubricScores: Record<string, number> = { ...rubricScores };

    // Build lookup of question categories to their AI scores
    const categoryScores: Record<string, number[]> = {};
    for (const qEval of aiEvaluation.questionEvaluations) {
      const q = questions.find((item) => item.id === qEval.questionId);
      if (q && q.category) {
        (categoryScores[q.category] ||= []).push(qEval.suggestedScore);
      }
    }

    for (const dim of allDims) {
      const label = dim.label;

      // Strategy A: Direct key match in aiEvaluation.rubricEvaluations
      if (aiEvaluation.rubricEvaluations && aiEvaluation.rubricEvaluations[label]) {
        nextRubricScores[label] = aiEvaluation.rubricEvaluations[label].suggestedScore;
        continue;
      }

      // Strategy B: Match based on question evaluations for this exact dimension category
      if (categoryScores[label] && categoryScores[label].length > 0) {
        const avg = Math.round(categoryScores[label].reduce((a, b) => a + b, 0) / categoryScores[label].length);
        nextRubricScores[label] = Math.min(4, Math.max(1, avg));
        continue;
      }

      // Strategy C: Normalized/Fuzzy match in rubricEvaluations
      if (aiEvaluation.rubricEvaluations) {
        const normalizedTarget = label.toLowerCase().replace(/[^a-z0-9]/g, '');
        let matched = false;
        for (const [key, evalData] of Object.entries(aiEvaluation.rubricEvaluations)) {
          const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (
            normalizedKey === normalizedTarget ||
            normalizedKey.includes(normalizedTarget) ||
            normalizedTarget.includes(normalizedKey)
          ) {
            nextRubricScores[label] = evalData.suggestedScore;
            matched = true;
            break;
          }
        }
        if (matched) continue;

        // Strategy D: Common aliases
        if (label === 'Logical Thinking & Problem Solving' && aiEvaluation.rubricEvaluations['Problem Solving']) {
          nextRubricScores[label] = aiEvaluation.rubricEvaluations['Problem Solving'].suggestedScore;
          continue;
        }
        if (label === 'Assertiveness & Comms' && (aiEvaluation.rubricEvaluations['Communication & Assertiveness'] || aiEvaluation.rubricEvaluations['Communication'])) {
          const commsEval = aiEvaluation.rubricEvaluations['Communication & Assertiveness'] || aiEvaluation.rubricEvaluations['Communication'];
          nextRubricScores[label] = commsEval.suggestedScore;
          continue;
        }
        if (label === 'People Management' && (aiEvaluation.rubricEvaluations['People Management'] || aiEvaluation.rubricEvaluations['Leadership'])) {
          const peopleEval = aiEvaluation.rubricEvaluations['People Management'] || aiEvaluation.rubricEvaluations['Leadership'];
          nextRubricScores[label] = peopleEval.suggestedScore;
          continue;
        }
      }
    }

    // 3. Populate Notes if empty
    let nextNotes = notes;
    if ((!nextNotes || !nextNotes.trim()) && aiEvaluation.overallSummary) {
      nextNotes = aiEvaluation.overallSummary;
      setNotes(nextNotes);
    }

    setQuestionScores(nextQuestionScores);
    setRubricScores(nextRubricScores);
    await patchSession({
      questionScores: nextQuestionScores,
      rubricScores: nextRubricScores,
      notes: nextNotes,
    });
    toast.success('All AI-suggested scores and notes applied!');
  };

  const handleApplyAiSummaryToNotes = () => {
    if (!aiEvaluation?.overallSummary) {
      toast.error('No AI assessment summary available.');
      return;
    }
    setNotes(aiEvaluation.overallSummary);
    void patchSession({ notes: aiEvaluation.overallSummary });
    toast.success('Applied AI assessment summary to notes.');
  };

  const handleAcceptSingleQuestionScore = (questionId: string, score: number) => {
    scoreQuestion(questionId, score);
    toast.success(`Applied AI score (${score}) to question.`);
  };

  return {
    loading, generating, submitting, error,
    session, activeRun, spec, setSpec, notes, setNotes,
    questionScores, rubricScores,
    transcriptText, transcriptTurns, aiEvaluation, transcriptFetchedAt, transcriptSource, isProcessingTranscript,
    handleFetchTranscriptFromTeams, handleUploadTranscript, handleUploadAudio,
    handleAcceptAllAiScores, handleAcceptSingleQuestionScore, handleApplyAiSummaryToNotes,
    isRunning, startedAt, elapsedSeconds, elapsedLabel,
    handleGenerate, handleToggleSubmit, scoreQuestion, scoreRubric, handleNotesBlur, updateQuestionMaxMarks,
    handleTimerStart, handleTimerPause, handleTimerResume, handleTimerReset,
    questions, orgTier, technicalDims, behaviouralDims, allDims,
    avgQuestionScore, scoredQuestionCount, avgRubricScore, ratedDimCount, gap, gapIsDiscrepant, dimensionGaps,
    handleDownloadCandidate, handleDownloadPanelist,
  };
}
