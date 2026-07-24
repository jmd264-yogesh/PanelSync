import { QuestionSet } from './schemas';

export class QuestionSetVerificationError extends Error {}

// The LLM proposes; this recomputes the arithmetic and cross-checks it never trusted the model for.
// `focusAreas` is the flat list of valid question categories — for the resume-driven flow
// that's Criteria.focusAreas; for the spec-driven flow it's spec-catalog's deriveFocusAreas(spec).
//
// Note: `totalMarks` is NOT cross-checked here — LLMs reliably slip on that exact arithmetic
// (add up N maxMarks correctly across a whole JSON payload), so instead of rejecting an
// otherwise-valid question set over it, the caller recomputes and overwrites `totalMarks`
// itself from `questions[].maxMarks` before this runs. See recomputeTotalMarks() below.
export function verifyQuestionSet(questionSet: QuestionSet, focusAreas: string[]): void {
  const focusAreaSet = new Set(focusAreas.map((f) => f.toLowerCase()));
  for (const q of questionSet.questions) {
    if (!focusAreaSet.has(q.category.toLowerCase())) {
      throw new QuestionSetVerificationError(
        `Question category "${q.category}" does not map to any of the panelist's focus areas.`
      );
    }
  }

  for (const q of questionSet.questions) {
    const bands = [...q.rubric].sort((a, b) => parseBandStart(a.band) - parseBandStart(b.band));
    let expectedStart = 0;
    for (const band of bands) {
      const { start, end } = parseBand(band.band);
      if (start !== expectedStart) {
        throw new QuestionSetVerificationError(
          `Question "${q.id}" rubric has a gap or overlap before band "${band.band}".`
        );
      }
      expectedStart = end + 1;
    }
    if (expectedStart - 1 !== q.maxMarks) {
      throw new QuestionSetVerificationError(
        `Question "${q.id}" rubric bands (up to ${expectedStart - 1}) do not cover the full 0-${q.maxMarks} range.`
      );
    }
  }
}

function parseBand(band: string): { start: number; end: number } {
  const match = band.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) {
    throw new QuestionSetVerificationError(`Rubric band "${band}" is not in the expected "N-M" format.`);
  }
  return { start: Number(match[1]), end: Number(match[2]) };
}

function parseBandStart(band: string): number {
  return parseBand(band).start;
}

// The only source of truth for totalMarks — call this on every question set before it's
// verified, stored, or displayed, instead of trusting whatever the model put in the field.
export function recomputeTotalMarks(questionSet: QuestionSet): QuestionSet {
  return { ...questionSet, totalMarks: questionSet.questions.reduce((sum, q) => sum + q.maxMarks, 0) };
}
