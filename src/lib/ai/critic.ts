// LLM-as-critic: the judgement half of the quality gate.
//
// guardrails.ts catches everything expressible as a rule (counts, duplicates, banned
// topics, malformed rubrics). What it can't catch is whether a question is actually any
// good — whether it discriminates between a competent and an excellent candidate, or
// whether it's a trivia question dressed up as an assessment. That needs a model, so
// this runs a second, independent pass over the draft with a reviewer persona and a
// deliberately adversarial brief.
//
// Design notes:
//  - Low temperature: we want consistent judgement, not creative judgement.
//  - Short retry budget: the critique is an enhancement. If it fails, the pipeline ships
//    the guardrail-passing draft rather than failing the whole run.
//  - It can only ever request changes to specific question ids; it cannot rewrite the
//    set itself, which keeps the blast radius of a bad critique small.

import { z } from 'zod';
import type { QuestionSet } from './schemas';
import { getAiProvider } from './provider';
import type { RetryPolicy } from './retry';

export const CritiqueSchema = z.object({
  overallScore: z.number().int().min(1).max(5),
  verdict: z.enum(['accept', 'revise']),
  summary: z.string().max(600),
  questionFindings: z.array(z.object({
    questionId: z.string(),
    issue: z.enum([
      'not_discriminative',
      'trivia_or_recall',
      'category_mismatch',
      'wrong_difficulty_for_round',
      'ambiguous_or_unanswerable',
      'weak_model_answer',
      'weak_rubric',
    ]),
    explanation: z.string().max(300),
    suggestion: z.string().max(300),
  })).max(12),
});
export type Critique = z.infer<typeof CritiqueSchema>;

const CRITIC_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 600,
  maxDelayMs: 3_000,
  deadlineMs: 30_000,
  attemptTimeoutMs: 25_000,
};

export interface CritiqueContext {
  roleGradeLabel: string;
  rubricTierLabel: string;
  rubricBar: string;
  round?: 'L1' | 'L2' | null;
}

function buildCriticPrompt(qs: QuestionSet, ctx: CritiqueContext): { systemPrompt: string; userPrompt: string } {
  const roundBrief = ctx.round === 'L1'
    ? 'This is an L1 (first) round: questions should be foundational and hands-on. Deep architecture or organisational questions are miscalibrated here.'
    : ctx.round === 'L2'
      ? 'This is an L2 (second) round for a candidate who already cleared L1: questions should go deeper than a screen (architecture, scale, ambiguity), and some should probe how the candidate plans, delivers, and leads work. Purely foundational questions are miscalibrated here.'
      : 'No specific round was given; judge difficulty against the role grade alone.';

  const systemPrompt = `You are a senior interview panelist reviewing a draft question set another panelist is about to use in a live interview. You are the last line of defence before it reaches a real candidate, so be genuinely critical — approving a weak set is worse than flagging a borderline one.

Judge the set against this bar:
- Role grade: ${ctx.roleGradeLabel} (${ctx.rubricTierLabel} rubric — the bar is: ${ctx.rubricBar})
- ${roundBrief}

For every question, ask yourself:
1. Would the answer actually separate a candidate who genuinely knows this from one who has only read about it? A question anyone could answer from a blog post is worthless.
2. Is it recall/trivia ("what does X stand for") rather than reasoning ("how would you decide between X and Y")? Trivia is a finding.
3. Does it genuinely belong to its stated category?
4. Is its difficulty right for this role grade AND this round?
5. Is the question unambiguous enough that a candidate knows what is being asked?
6. Does the model answer describe what a strong answer covers concretely enough to score against?
7. Do the rubric bands describe observable behaviours, not vague vibes ("good understanding")?

Rules:
- Only report findings for questions that genuinely have a problem. Do not invent findings to seem thorough; an excellent set should come back with an empty "questionFindings" list and verdict "accept".
- "overallScore": 5 = ready to use as-is, 3 = usable but with real weaknesses, 1 = should not be used.
- Set "verdict" to "revise" only if at least one question genuinely needs replacing or rewriting.
- Reference questions by their exact "id".

Respond with JSON only, matching the required schema exactly.`;

  const compact = qs.questions.map((q) => ({
    id: q.id,
    category: q.category,
    difficulty: q.difficulty,
    question: q.question,
    modelAnswer: q.modelAnswer,
    rubric: q.rubric.map((b) => `${b.band}: ${b.description}`),
  }));

  return { systemPrompt, userPrompt: `Draft question set to review:\n${JSON.stringify(compact, null, 2)}` };
}

export interface CritiqueResult {
  critique: Critique | null;
  /** Populated when the critique pass itself failed — non-fatal, recorded in diagnostics. */
  error?: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs?: number;
}

export async function critiqueQuestionSet(
  qs: QuestionSet,
  ctx: CritiqueContext,
  signal?: AbortSignal,
): Promise<CritiqueResult> {
  const { systemPrompt, userPrompt } = buildCriticPrompt(qs, ctx);
  const startedAt = Date.now();
  try {
    const result = await getAiProvider().generateStructured({
      systemPrompt,
      userPrompt,
      zodSchema: CritiqueSchema,
      retryPolicy: CRITIC_RETRY_POLICY,
      temperature: 0.1,
      signal,
    });
    return {
      critique: result.data,
      tokenUsage: result.tokenUsage,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    // Never fail a run because the optional quality pass fell over.
    return {
      critique: null,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - startedAt,
    };
  }
}
