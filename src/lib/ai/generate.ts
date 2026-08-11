// The agentic generation pipeline.
//
//   draft ─► schema validation (provider, with one repair round-trip)
//         ─► deterministic guardrails ──┐ blocking issues? ──► targeted repair, re-validate
//         ─► LLM critic (quality) ──────┘ revise requested? ─► targeted revision, re-validate
//         ─► accept
//
// Two invariants hold throughout, and they're what make this trustworthy rather than
// just elaborate:
//
//  1. Nothing is ever accepted without passing the deterministic guardrails. A repair or
//     revision that fails them is discarded, and the previous best draft is kept — the
//     pipeline can improve output but can never regress it.
//  2. Every model call is bounded (attempt timeout, overall deadline, attempt cap), so a
//     misbehaving provider degrades into a clean error instead of an open-ended hang.

import type { Spec, QuestionSet } from './schemas';
import { QuestionSetSchema } from './schemas';
import { getAiProvider } from './provider';
import type { TokenUsage } from './provider';
import { buildSpecQuestionPrompt, buildRepairPrompt, PROMPT_VERSION } from './prompts';
import { recomputeTotalMarks } from './verify';
import {
  inspectQuestionSet, blockingFindings, formatFindingsForRepair, summarizeFindings,
  type Finding, type GuardrailContext,
} from './guardrails';
import { critiqueQuestionSet, type Critique } from './critic';
import { AiError } from './errors';
import { ROLE_GRADES, sortByDifficulty } from './spec-catalog';
import { ORG_TIER_BAR, ORG_TIER_LABEL, getOrgTier } from './org-rubric';

export interface GenerateInput {
  spec: Spec;
  focusAreas: string[];
  behaviouralCategories: string[];
  round: 'L1' | 'L2' | null;
  /** Off for cheap/fast paths; on by default because it's the main quality lever. */
  enableCritique?: boolean;
  /** How many corrective round-trips to allow for guardrail failures. */
  maxRepairAttempts?: number;
  signal?: AbortSignal;
}

export interface GenerationStage {
  stage: 'draft' | 'repair' | 'revision';
  attempt: number;
  findingCodes: string[];
  blockingCount: number;
  accepted: boolean;
  note?: string;
}

export interface GenerationDiagnostics {
  promptVersion: string;
  model: string;
  round: 'L1' | 'L2' | null;
  /** Ordered record of everything the pipeline tried and what it decided. */
  stages: GenerationStage[];
  /** Guardrail findings on the question set actually returned. */
  finalFindings: Finding[];
  transportAttempts: number;
  schemaRepairUsed: boolean;
  critique: { score: number; verdict: Critique['verdict']; summary: string; findingCount: number } | null;
  critiqueError?: string;
  revisionApplied: boolean;
  tokenUsage: TokenUsage;
  latencyMs: number;
}

export interface GenerateOutput {
  questionSet: QuestionSet;
  diagnostics: GenerationDiagnostics;
  model: string;
  tokenUsage: TokenUsage;
}

const DEFAULT_MAX_REPAIR_ATTEMPTS = 2;

function addUsage(a: TokenUsage, b: TokenUsage | undefined): TokenUsage {
  if (!b) return a;
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export async function generateQuestionSetAgentic(input: GenerateInput): Promise<GenerateOutput> {
  const {
    spec, focusAreas, behaviouralCategories, round,
    enableCritique = true,
    maxRepairAttempts = DEFAULT_MAX_REPAIR_ATTEMPTS,
    signal,
  } = input;

  const startedAt = Date.now();
  const provider = getAiProvider();
  const orgTier = getOrgTier(spec.roleGrade);

  const guardrailCtx: GuardrailContext = {
    expectedCount: spec.questionCount,
    allowedCategories: focusAreas,
    behaviouralCategories,
    round,
  };

  const basePrompt = buildSpecQuestionPrompt(spec, focusAreas, round);
  const stages: GenerationStage[] = [];
  let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let transportAttempts = 0;
  let schemaRepairUsed = false;
  let model = '';

  // ── Phase 1: draft, then repair until the deterministic guardrails pass ────
  let best: QuestionSet | null = null;
  let bestFindings: Finding[] = [];
  let prompt = basePrompt;

  for (let attempt = 1; attempt <= maxRepairAttempts + 1; attempt++) {
    const result = await provider.generateStructured({
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      zodSchema: QuestionSetSchema,
      signal,
    });

    model = result.model;
    usage = addUsage(usage, result.tokenUsage);
    transportAttempts += result.telemetry.transportAttempts;
    schemaRepairUsed = schemaRepairUsed || result.telemetry.schemaRepairUsed;

    const candidate = recomputeTotalMarks(result.data);
    const findings = inspectQuestionSet(candidate, guardrailCtx);
    const blocking = blockingFindings(findings);

    const isFirst = attempt === 1;
    // Keep whichever draft is closest to acceptable, so a failed repair never leaves us
    // worse off than the draft it was trying to improve.
    if (!best || blocking.length < blockingFindings(bestFindings).length) {
      best = candidate;
      bestFindings = findings;
    }

    stages.push({
      stage: isFirst ? 'draft' : 'repair',
      attempt,
      findingCodes: [...new Set(findings.map((f) => f.code))],
      blockingCount: blocking.length,
      accepted: blocking.length === 0,
    });

    if (blocking.length === 0) break;

    if (attempt <= maxRepairAttempts) {
      prompt = buildRepairPrompt(basePrompt, candidate, formatFindingsForRepair(blocking));
    }
  }

  if (!best) {
    throw new AiError('UNKNOWN', 'Generation produced no candidate question set.');
  }

  const remainingBlocking = blockingFindings(bestFindings);
  if (remainingBlocking.length > 0) {
    // Exhausted repairs and it still isn't safe to show. Failing loudly is correct here:
    // these are things like banned topics or broken rubrics, not cosmetic nits.
    throw new AiError(
      'GUARDRAIL',
      `The AI produced questions that failed quality checks after ${maxRepairAttempts} correction attempts (${summarizeFindings(remainingBlocking)}). Please try generating again.`,
      { detail: remainingBlocking },
    );
  }

  // ── Phase 2: quality critique + optional targeted revision ─────────────────
  let critiqueSummary: GenerationDiagnostics['critique'] = null;
  let critiqueError: string | undefined;
  let revisionApplied = false;

  if (enableCritique) {
    const { critique, error, tokenUsage: critiqueUsage } = await critiqueQuestionSet(
      best,
      {
        roleGradeLabel: ROLE_GRADES[spec.roleGrade].label,
        rubricTierLabel: ORG_TIER_LABEL[orgTier],
        rubricBar: ORG_TIER_BAR[orgTier],
        round,
      },
      signal,
    );
    usage = addUsage(usage, critiqueUsage);
    critiqueError = error;

    if (critique) {
      critiqueSummary = {
        score: critique.overallScore,
        verdict: critique.verdict,
        summary: critique.summary,
        findingCount: critique.questionFindings.length,
      };

      if (critique.verdict === 'revise' && critique.questionFindings.length > 0) {
        const issues = critique.questionFindings
          .map((f) => `- (question "${f.questionId}") [${f.issue}] ${f.explanation} FIX: ${f.suggestion}`)
          .join('\n');
        const revisionPrompt = buildRepairPrompt(basePrompt, best, issues);

        try {
          const revised = await provider.generateStructured({
            systemPrompt: revisionPrompt.systemPrompt,
            userPrompt: revisionPrompt.userPrompt,
            zodSchema: QuestionSetSchema,
            signal,
          });
          usage = addUsage(usage, revised.tokenUsage);
          transportAttempts += revised.telemetry.transportAttempts;

          const candidate = recomputeTotalMarks(revised.data);
          const findings = inspectQuestionSet(candidate, guardrailCtx);
          const blocking = blockingFindings(findings);

          // Only take the revision if it's still clean. A revision that fixes a critic's
          // stylistic gripe but breaks a rubric is a downgrade, not an improvement.
          if (blocking.length === 0) {
            best = candidate;
            bestFindings = findings;
            revisionApplied = true;
          }

          stages.push({
            stage: 'revision',
            attempt: stages.length + 1,
            findingCodes: [...new Set(findings.map((f) => f.code))],
            blockingCount: blocking.length,
            accepted: blocking.length === 0,
            note: blocking.length === 0 ? 'critic revision applied' : 'critic revision discarded — it failed guardrails',
          });
        } catch (err) {
          // A failed revision is not a failed run; we already have a validated draft.
          stages.push({
            stage: 'revision',
            attempt: stages.length + 1,
            findingCodes: [],
            blockingCount: 0,
            accepted: false,
            note: `critic revision errored: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    }
  }

  const ordered: QuestionSet = { ...best, questions: sortByDifficulty(best.questions) };

  return {
    questionSet: ordered,
    model,
    tokenUsage: usage,
    diagnostics: {
      promptVersion: PROMPT_VERSION,
      model,
      round,
      stages,
      finalFindings: bestFindings,
      transportAttempts,
      schemaRepairUsed,
      critique: critiqueSummary,
      critiqueError,
      revisionApplied,
      tokenUsage: usage,
      latencyMs: Date.now() - startedAt,
    },
  };
}
