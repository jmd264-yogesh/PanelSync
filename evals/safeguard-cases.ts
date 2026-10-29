// Regression cases for the pre-demo fixes: the feedback edit window, shared AI score
// suggestions, audio content-type allow-list, and panel-token redaction.

import { feedbackEditState, FEEDBACK_EDIT_WINDOW_MS } from '../src/lib/feedback-window';
import { resolveSuggestedRubricScores } from '../src/lib/recalibrate/ai-suggestions';
import { extensionForAudioMime, normalizeAudioMime } from '../src/lib/audio-mime';
import { interviewForPanelist } from '../src/lib/panel-dto';
import type { AiTranscriptEvaluation, Interview, InterviewPanel } from '../src/lib/db';

export interface SafeguardCase {
  name: string;
  run: () => { ok: boolean; detail?: string };
}

const eq = (got: unknown, want: unknown) => ({ ok: got === want, detail: `got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}` });

const NOW = Date.parse('2026-10-29T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

const evaluation = (over: Partial<AiTranscriptEvaluation>): AiTranscriptEvaluation => ({
  overallSummary: '',
  questionEvaluations: [],
  rubricEvaluations: {},
  confidence: 'medium',
  evaluatedAt: '2026-10-29T12:00:00Z',
  ...over,
});

const panel = (id: string, token: string): InterviewPanel => ({
  id, interviewId: 'i1', userId: `u-${id}`, name: `Panelist ${id}`, email: `${id}@x.com`, token,
  status: 'SUBMITTED', feedback: `private feedback of ${id}`, decision: 'PASSED', availabilities: [],
});

export const SAFEGUARD_CASES: SafeguardCase[] = [
  // ── Feedback edit window ────────────────────────────────────────────────
  {
    name: 'first feedback is allowed even if the slot was booked days ago',
    run: () => eq(feedbackEditState({ decision: null, submittedAt: hoursAgo(72) }, NOW), 'first'),
  },
  { name: 'feedback can be edited inside the 2-hour window', run: () => eq(feedbackEditState({ decision: 'PASSED', submittedAt: hoursAgo(1) }, NOW), 'editable') },
  { name: 'feedback is locked after the 2-hour window', run: () => eq(feedbackEditState({ decision: 'REJECTED', submittedAt: hoursAgo(3) }, NOW), 'expired') },
  { name: 'the window is exactly two hours', run: () => eq(FEEDBACK_EDIT_WINDOW_MS, 7_200_000) },

  // ── AI suggestions: badge and Apply use one resolver ────────────────────
  {
    name: 'uses the AI rubric rating when it has evidence',
    run: () => {
      const r = resolveSuggestedRubricScores(
        evaluation({ rubricEvaluations: { 'SQL Proficiency': { suggestedScore: 3, reasoning: 'solid' } } }),
        ['SQL Proficiency'], [],
      );
      return eq(r['SQL Proficiency'].score, 3);
    },
  },
  {
    name: 'falls back to the average of scored questions when the AI rated the row 0',
    run: () => {
      const r = resolveSuggestedRubricScores(
        evaluation({
          rubricEvaluations: { Snowflake: { suggestedScore: 0, reasoning: 'none' } },
          questionEvaluations: [
            { questionId: 'a', suggestedScore: 3, candidateAnswerSummary: '', verbatimQuote: null, reasoning: '', strengths: [], gaps: [] },
            { questionId: 'b', suggestedScore: 4, candidateAnswerSummary: '', verbatimQuote: null, reasoning: '', strengths: [], gaps: [] },
          ],
        }),
        ['Snowflake'],
        [{ id: 'a', category: 'Snowflake' }, { id: 'b', category: 'Snowflake' }],
      );
      return eq(r.Snowflake.score, 4);
    },
  },
  {
    name: 'a row with no evidence stays 0 (never applied)',
    run: () => eq(resolveSuggestedRubricScores(evaluation({}), ['dbt'], [])['dbt'].score, 0),
  },
  {
    name: 'matches behavioural aliases',
    run: () => {
      const r = resolveSuggestedRubricScores(
        evaluation({ rubricEvaluations: { Communication: { suggestedScore: 2, reasoning: '' } } }),
        ['Assertiveness & Comms'], [],
      );
      return eq(r['Assertiveness & Comms'].score, 2);
    },
  },

  // ── Audio content types ─────────────────────────────────────────────────
  { name: 'accepts a recorder type with codecs', run: () => eq(normalizeAudioMime('audio/webm;codecs=opus'), 'audio/webm') },
  { name: 'rejects text/html masquerading as audio', run: () => eq(normalizeAudioMime('text/html'), null) },
  { name: 'rejects a type that only starts with "audio"', run: () => eq(normalizeAudioMime('audio/webm-evil/../html'), null) },
  { name: 'rejects a missing type', run: () => eq(normalizeAudioMime(undefined), null) },
  { name: 'Safari recordings (audio/mp4) get an m4a extension, not webm', run: () => eq(extensionForAudioMime('audio/mp4'), 'm4a') },

  // ── Panel tokens ────────────────────────────────────────────────────────
  {
    name: 'a panelist only receives their own panel (no co-panelist tokens or feedback)',
    run: () => {
      const interview = { id: 'i1', panels: [panel('a', 'tok-a'), panel('b', 'tok-b'), panel('c', 'tok-c')] } as unknown as Interview;
      const dto = interviewForPanelist(interview, 'a');
      const leaked = JSON.stringify(dto).includes('tok-b') || JSON.stringify(dto).includes('private feedback of c');
      return { ok: dto.panels.length === 1 && dto.panels[0].id === 'a' && !leaked, detail: JSON.stringify(dto.panels.map((p) => p.id)) };
    },
  },
];
