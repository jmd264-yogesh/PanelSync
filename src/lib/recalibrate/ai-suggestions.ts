// Turns an AI transcript evaluation into the score the panelist would be offered for each
// rubric row. This used to be written twice (once to draw the "AI: n" badges, once to
// apply them) and the copies disagreed — a badge could read "AI 0/4" while Apply All
// then wrote a 3 — so both now call this one function.

import type { AiTranscriptEvaluation } from '../db';

export interface SuggestedRubricScore {
  /** 0 means the AI found no evidence for this row; it is never applied. */
  score: number;
  reasoning?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Older evaluations (and the odd model reply) use these names for the behavioural rows.
const ALIASES: Record<string, string[]> = {
  'Logical Thinking & Problem Solving': ['Problem Solving'],
  'Assertiveness & Comms': ['Communication & Assertiveness', 'Communication'],
  'People Management': ['People Management', 'Leadership'],
};

type Rubric = AiTranscriptEvaluation['rubricEvaluations'];

function findRubricEvaluation(rubric: Rubric | undefined, label: string) {
  if (!rubric) return null;
  if (rubric[label]) return rubric[label];

  const target = norm(label);
  for (const [key, value] of Object.entries(rubric)) {
    const k = norm(key);
    if (k === target || k.includes(target) || target.includes(k)) return value;
  }
  for (const alias of ALIASES[label] ?? []) {
    if (rubric[alias]) return rubric[alias];
  }
  return null;
}

export function resolveSuggestedRubricScores(
  evaluation: AiTranscriptEvaluation | null | undefined,
  labels: string[],
  questions: Array<{ id: string; category: string }>,
): Record<string, SuggestedRubricScore> {
  const result: Record<string, SuggestedRubricScore> = {};
  if (!evaluation) return result;

  // Average of the AI's scores for the questions asked in each category (only questions it
  // actually found an answer to).
  const categoryScores: Record<string, number[]> = {};
  for (const q of evaluation.questionEvaluations || []) {
    if (q.suggestedScore <= 0) continue;
    const question = questions.find((item) => item.id === q.questionId);
    if (question?.category) (categoryScores[question.category] ||= []).push(q.suggestedScore);
  }

  for (const label of labels) {
    const direct = findRubricEvaluation(evaluation.rubricEvaluations, label);
    if (direct && direct.suggestedScore > 0) {
      result[label] = { score: direct.suggestedScore, reasoning: direct.reasoning };
      continue;
    }

    // The AI gave the row no rating of its own (or 0) but did score questions in that area.
    const scores = categoryScores[label];
    if (scores?.length) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      result[label] = {
        score: Math.min(4, Math.max(1, avg)),
        reasoning: `Based on ${scores.length} scored question${scores.length === 1 ? '' : 's'} in this area.`,
      };
      continue;
    }

    result[label] = {
      score: 0,
      reasoning: direct?.reasoning || 'No transcript evidence or discussion for this dimension.',
    };
  }
  return result;
}
