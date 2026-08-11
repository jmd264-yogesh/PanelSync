import { QuestionSet } from './schemas';
import { blockingFindings, inspectQuestionSet, summarizeFindings, type GuardrailContext } from './guardrails';

export class QuestionSetVerificationError extends Error {}

// The LLM proposes; this recomputes the arithmetic and cross-checks it never trusted the model for.
// `focusAreas` is the flat list of valid question categories — for the resume-driven flow
// that's Criteria.focusAreas; for the spec-driven flow it's org-rubric's deriveFocusAreas(spec).
//
// This is the throwing gate used by callers that just need pass/fail (notably the
// panelist-edit PATCH route). The checks themselves live in guardrails.ts so that the
// generation pipeline, this gate, and the eval suite can never drift apart — a rule added
// there is enforced everywhere at once.
//
// Note: `totalMarks` is NOT cross-checked here — LLMs reliably slip on that exact
// arithmetic (add up N maxMarks correctly across a whole JSON payload), so instead of
// rejecting an otherwise-valid question set over it, the caller recomputes and overwrites
// `totalMarks` itself from `questions[].maxMarks` before this runs. See recomputeTotalMarks().
export function verifyQuestionSet(
  questionSet: QuestionSet,
  focusAreas: string[],
  options: Partial<Omit<GuardrailContext, 'allowedCategories'>> = {},
): void {
  const findings = inspectQuestionSet(questionSet, {
    expectedCount: options.expectedCount ?? questionSet.questions.length,
    allowedCategories: focusAreas,
    behaviouralCategories: options.behaviouralCategories ?? [],
    round: options.round ?? null,
  });

  const blocking = blockingFindings(findings);
  if (blocking.length > 0) {
    throw new QuestionSetVerificationError(
      `Question set failed validation (${summarizeFindings(blocking)}). ${blocking[0].message}`,
    );
  }
}

// The only source of truth for totalMarks — call this on every question set before it's
// verified, stored, or displayed, instead of trusting whatever the model put in the field.
export function recomputeTotalMarks(questionSet: QuestionSet): QuestionSet {
  return { ...questionSet, totalMarks: questionSet.questions.reduce((sum, q) => sum + q.maxMarks, 0) };
}
