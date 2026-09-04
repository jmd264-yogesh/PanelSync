// Deterministic guardrails for AI-generated question sets.
//
// These run on every generation before a panelist ever sees the output, and again on
// any repaired output. They are pure functions over the parsed QuestionSet — no network,
// no model — so they're fast, free, reproducible, and directly reusable as eval
// assertions (see evals/). The LLM critic in critic.ts handles the judgement calls that
// can't be expressed as a rule; everything expressible as a rule belongs here instead,
// because a rule can't hallucinate.
//
// Severity contract:
//   'error' — never show this to a panelist. Triggers a repair attempt, and fails the
//             run if it survives repair.
//   'warn'  — worth recording and surfacing in diagnostics, but not worth blocking an
//             otherwise usable question set over.

import type { QuestionSet, Question } from './schemas';

export type FindingSeverity = 'error' | 'warn';

export interface Finding {
  code: string;
  severity: FindingSeverity;
  message: string;
  questionId?: string;
  /** Concrete instruction handed back to the model when asking it to fix this. */
  repairHint: string;
}

export interface GuardrailContext {
  expectedCount: number;
  /** Category labels the model was told it may use. */
  allowedCategories: string[];
  /** Subset of allowedCategories that assess behaviour rather than technical skill. */
  behaviouralCategories: string[];
  round?: 'L1' | 'L2' | null;
}

// ── Text helpers ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'do', 'does', 'for', 'from', 'how', 'i',
  'in', 'is', 'it', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'where', 'which', 'who', 'why',
  'with', 'would', 'you', 'your', 'that', 'this', 'have', 'has', 'can', 'could', 'should',
]);

function contentTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** Jaccard overlap of content words — cheap near-duplicate detection that survives reordering and rephrasing. */
export function similarity(a: string, b: string): number {
  const ta = contentTokens(a);
  const tb = contentTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) if (tb.has(token)) intersection += 1;
  return intersection / (ta.size + tb.size - intersection);
}

const DUPLICATE_THRESHOLD = 0.62;

// ── Safety / compliance patterns ─────────────────────────────────────────────

// Questions that are unlawful or discriminatory to ask in an interview in most
// jurisdictions (and against policy regardless). An LLM asked for "practical, real-world"
// questions can absolutely drift into "how do you balance this with family commitments?",
// and that must never reach a live interview. Phrases are deliberately multi-word and
// specific — matching the bare word "age" or "family" would fire on legitimate questions
// like "data age" or "job family", so specificity here is what keeps this usable.
const DISCRIMINATORY_PATTERNS: { pattern: RegExp; topic: string }[] = [
  { pattern: /\bhow old are you\b|\bwhat is your age\b|\byour age\b/i, topic: 'age' },
  { pattern: /\bmarital status\b|\bare you married\b|\byour spouse\b|\bhusband or wife\b/i, topic: 'marital status' },
  { pattern: /\bdo you have (?:any )?(?:children|kids)\b|\bplan(?:ning)? to have (?:children|kids)\b|\bare you pregnant\b|\bpregnan(?:cy|t)\b|\bchildcare\b|\bfamily commitments?\b|\bstart a family\b/i, topic: 'family / pregnancy' },
  { pattern: /\byour religion\b|\breligious (?:beliefs?|practices?|holidays?)\b|\bwhich (?:church|temple|mosque)\b/i, topic: 'religion' },
  { pattern: /\byour (?:nationality|caste|ethnicity|race)\b|\bwhere are you (?:originally|really) from\b|\bcountry of (?:birth|origin)\b|\bnative language\b/i, topic: 'national origin / ethnicity' },
  { pattern: /\byour gender\b|\bsexual orientation\b|\bare you (?:a )?(?:man|woman) /i, topic: 'gender / orientation' },
  { pattern: /\byour disability\b|\bare you disabled\b|\bhealth condition\b|\bmedical (?:history|condition)\b|\bmental health\b/i, topic: 'disability / health' },
  { pattern: /\bpolitical (?:views?|affiliation|party)\b|\bwho did you vote\b/i, topic: 'political affiliation' },
  { pattern: /\bdo you (?:drink|smoke)\b|\balcohol consumption\b/i, topic: 'lifestyle' },
];

const PII_PATTERNS: { pattern: RegExp; kind: string }[] = [
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]{2,}/, kind: 'email address' },
  { pattern: /(?:\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/, kind: 'phone number' },
];

const PLACEHOLDER_PATTERNS = /\b(?:TODO|TBD|FIXME|lorem ipsum|placeholder|xxxx+)\b|\[(?:insert|your|candidate|company)[^\]]*\]|\{\{[^}]*\}\}/i;

// First-person phrasing means the model wrote a simulated candidate answer instead of a
// panelist-facing description of what a strong answer contains.
const FIRST_PERSON_PATTERNS = /\b(?:I would|I'd|I will|I'll|I have|I've|my approach|my strategy|in my experience|I typically|I usually|I start|I'd start)\b/i;

const CODE_MARKERS = /```|\bwrite (?:a|the|some) (?:query|function|script|code|sql)\b|\bcode snippet\b|\bimplement (?:a|the) (?:function|class|method|query)\b|\bSELECT\s+\*/i;

// Signals that a question probes delivery ownership rather than pure technical skill —
// what an L2 round is supposed to additionally test.
const DELIVERY_MARKERS = /\bstakeholder|\btimeline|\bdeadline|\bprioriti|\bscope\b|\bdeliver|\bsprint|\bestimat|\broadmap|\bmentor|\bdelay|\bproject plan|\bmilestone|\btrade-?off|\bnegotiat|\bescalat|\bcross-functional/i;

// ── Individual checks ────────────────────────────────────────────────────────

function checkStructure(qs: QuestionSet, ctx: GuardrailContext): Finding[] {
  const findings: Finding[] = [];

  if (qs.questions.length !== ctx.expectedCount) {
    findings.push({
      code: 'COUNT_MISMATCH',
      severity: 'error',
      message: `Expected exactly ${ctx.expectedCount} questions, got ${qs.questions.length}.`,
      repairHint: `Return exactly ${ctx.expectedCount} questions — no more, no fewer.`,
    });
  }

  const ids = new Set<string>();
  for (const q of qs.questions) {
    if (ids.has(q.id)) {
      findings.push({
        code: 'DUPLICATE_ID',
        severity: 'error',
        message: `Question id "${q.id}" is used more than once.`,
        questionId: q.id,
        repairHint: 'Give every question a unique "id".',
      });
    }
    ids.add(q.id);
  }

  return findings;
}

function checkCategories(qs: QuestionSet, ctx: GuardrailContext): Finding[] {
  const findings: Finding[] = [];
  const allowed = new Map(ctx.allowedCategories.map((c) => [c.toLowerCase(), c]));
  const behavioural = new Set(ctx.behaviouralCategories.map((c) => c.toLowerCase()));
  const usage = new Map<string, number>();

  for (const q of qs.questions) {
    const key = q.category.toLowerCase();
    if (!allowed.has(key)) {
      findings.push({
        code: 'UNKNOWN_CATEGORY',
        severity: 'error',
        message: `Question "${q.id}" uses category "${q.category}", which is not one of the selected categories.`,
        questionId: q.id,
        repairHint: `Set "category" to exactly one of: ${ctx.allowedCategories.join(', ')}.`,
      });
      continue;
    }
    usage.set(key, (usage.get(key) ?? 0) + 1);

    if (behavioural.has(key) && CODE_MARKERS.test(q.question)) {
      findings.push({
        code: 'CODING_IN_BEHAVIOURAL',
        severity: 'error',
        message: `Question "${q.id}" is in behavioural category "${q.category}" but asks for code.`,
        questionId: q.id,
        repairHint: 'Behavioural categories assess judgement and communication — replace this with a non-coding question.',
      });
    }
  }

  // Only meaningful once there are at least as many questions as categories; below that
  // a category legitimately can't be covered.
  if (qs.questions.length >= ctx.allowedCategories.length) {
    for (const [key, label] of allowed) {
      if (!usage.has(key)) {
        findings.push({
          code: 'CATEGORY_NOT_COVERED',
          severity: 'warn',
          message: `No question covers "${label}", even though there was room for one.`,
          repairHint: `Make sure every selected category gets at least one question, including "${label}".`,
        });
      }
    }
  }

  const maxShare = Math.max(0, ...usage.values()) / Math.max(1, qs.questions.length);
  if (ctx.allowedCategories.length >= 3 && maxShare > 0.6) {
    findings.push({
      code: 'CATEGORY_IMBALANCE',
      severity: 'warn',
      message: `Over ${Math.round(maxShare * 100)}% of questions fall in a single category.`,
      repairHint: 'Spread questions more evenly across the selected categories.',
    });
  }

  return findings;
}

function checkRubric(q: Question): Finding[] {
  const findings: Finding[] = [];

  // Check 1-4 discrete bands format (e.g. "1", "2", "3", "4" or "1 - ...")
  const singleNumberMatches = q.rubric.map((b) => {
    const m = b.band.match(/^\s*(\d+)/);
    return m ? Number(m[1]) : null;
  });

  if (singleNumberMatches.every((n) => n !== null)) {
    const numbers = (singleNumberMatches as number[]).sort((a, b) => a - b);
    if (numbers.length === 4 && numbers[0] === 1 && numbers[3] === 4) {
      return findings; // Valid 1-4 scale rubric
    }
  }

  // Legacy range format checking (e.g. 0-1, 2-3, 4-5)
  const parsed: { start: number; end: number; raw: string }[] = [];

  for (const band of q.rubric) {
    const match = band.band.match(/(\d+)\s*-\s*(\d+)/);
    if (!match) {
      const singleM = band.band.match(/^\s*(\d+)/);
      if (singleM) {
        const val = Number(singleM[1]);
        parsed.push({ start: val, end: val, raw: band.band });
        continue;
      }
      findings.push({
        code: 'RUBRIC_BAND_FORMAT',
        severity: 'error',
        message: `Question "${q.id}" has rubric band "${band.band}", which is not a valid score band.`,
        questionId: q.id,
        repairHint: 'Every rubric "band" must be a score number ("1", "2", "3", "4") or numeric range.',
      });
      return findings;
    }
    parsed.push({ start: Number(match[1]), end: Number(match[2]), raw: band.band });
  }

  parsed.sort((a, b) => a.start - b.start);
  return findings;
}

function checkContent(q: Question): Finding[] {
  const findings: Finding[] = [];
  const combined = `${q.question}\n${q.modelAnswer}\n${q.intent}`;

  if (q.question.trim().length < 25) {
    findings.push({
      code: 'QUESTION_TOO_SHORT',
      severity: 'error',
      message: `Question "${q.id}" is too short to be a real interview question.`,
      questionId: q.id,
      repairHint: 'Write a complete, specific interview question.',
    });
  }

  if (!q.modelAnswer || q.modelAnswer.trim().length === 0) {
    findings.push({
      code: 'MODEL_ANSWER_MISSING',
      severity: 'error',
      message: `Question "${q.id}" has no model answer.`,
      questionId: q.id,
      repairHint: 'Every question needs a "modelAnswer" describing what a strong answer covers.',
    });
  } else if (q.modelAnswer.trim().length < 80) {
    findings.push({
      code: 'MODEL_ANSWER_TOO_SHORT',
      severity: 'error',
      message: `Question "${q.id}" has a model answer too thin to score against (${q.modelAnswer.trim().length} chars).`,
      questionId: q.id,
      repairHint: 'Expand "modelAnswer" to 2-4 sentences naming the specific points a strong answer covers.',
    });
  } else if (FIRST_PERSON_PATTERNS.test(q.modelAnswer)) {
    findings.push({
      code: 'MODEL_ANSWER_FIRST_PERSON',
      severity: 'error',
      message: `Question "${q.id}" model answer is written in first person, as if answering rather than describing.`,
      questionId: q.id,
      repairHint: 'Rewrite "modelAnswer" objectively ("A strong answer identifies X, then explains Y"), never as "I would...".',
    });
  }

  if (PLACEHOLDER_PATTERNS.test(combined)) {
    findings.push({
      code: 'PLACEHOLDER_TEXT',
      severity: 'error',
      message: `Question "${q.id}" contains placeholder text.`,
      questionId: q.id,
      repairHint: 'Remove all placeholder/template text and write real content.',
    });
  }

  // A question ending mid-sentence usually means the response was cut off by a token
  // limit — the rest of the payload can still parse cleanly, so schema validation alone
  // won't catch it.
  if (/\S/.test(q.question) && !/[?.!)"']\s*$/.test(q.question.trim())) {
    findings.push({
      code: 'TRUNCATED_QUESTION',
      severity: 'error',
      message: `Question "${q.id}" appears truncated — it does not end with sentence punctuation.`,
      questionId: q.id,
      repairHint: 'Return the complete question text ending in proper punctuation.',
    });
  }

  for (const { pattern, topic } of DISCRIMINATORY_PATTERNS) {
    if (pattern.test(combined)) {
      findings.push({
        code: 'DISCRIMINATORY_TOPIC',
        severity: 'error',
        message: `Question "${q.id}" touches ${topic}, which must never be asked in an interview.`,
        questionId: q.id,
        repairHint: `Replace this question entirely. Never reference ${topic} or any other protected characteristic — ask only about job-relevant skills and experience.`,
      });
      break;
    }
  }

  for (const { pattern, kind } of PII_PATTERNS) {
    if (pattern.test(combined)) {
      findings.push({
        code: 'PII_LEAK',
        severity: 'error',
        message: `Question "${q.id}" contains what looks like a real ${kind}.`,
        questionId: q.id,
        repairHint: 'Remove all personal contact details — questions must be generic to the role, not to any individual.',
      });
      break;
    }
  }

  return findings;
}

function checkDuplicates(qs: QuestionSet): Finding[] {
  const findings: Finding[] = [];
  for (let i = 0; i < qs.questions.length; i++) {
    for (let j = i + 1; j < qs.questions.length; j++) {
      const score = similarity(qs.questions[i].question, qs.questions[j].question);
      if (score >= DUPLICATE_THRESHOLD) {
        findings.push({
          code: 'DUPLICATE_QUESTION',
          severity: 'error',
          message: `Questions "${qs.questions[i].id}" and "${qs.questions[j].id}" are near-duplicates (${Math.round(score * 100)}% overlap).`,
          questionId: qs.questions[j].id,
          repairHint: `Replace question "${qs.questions[j].id}" with one that tests something genuinely different.`,
        });
      }
    }
  }
  return findings;
}

function checkRoundCalibration(qs: QuestionSet, ctx: GuardrailContext): Finding[] {
  const findings: Finding[] = [];
  if (!ctx.round || qs.questions.length === 0) return findings;

  const hard = qs.questions.filter((q) => q.difficulty === 'hard').length;
  const easy = qs.questions.filter((q) => q.difficulty === 'easy').length;
  const total = qs.questions.length;

  if (ctx.round === 'L1' && hard / total > 0.4) {
    findings.push({
      code: 'DIFFICULTY_SKEW_L1',
      severity: 'warn',
      message: `L1 round is ${Math.round((hard / total) * 100)}% hard questions — L1 should stay foundational.`,
      repairHint: 'Skew L1 difficulty toward easy/medium; move deep architecture questions to L2.',
    });
  }

  if (ctx.round === 'L2') {
    if (easy / total > 0.5) {
      findings.push({
        code: 'DIFFICULTY_SKEW_L2',
        severity: 'warn',
        message: `L2 round is ${Math.round((easy / total) * 100)}% easy questions — L2 should go deeper than a first-round screen.`,
        repairHint: 'Skew L2 difficulty toward medium/hard.',
      });
    }
    const deliveryQuestions = qs.questions.filter((q) => DELIVERY_MARKERS.test(q.question)).length;
    if (deliveryQuestions === 0) {
      findings.push({
        code: 'L2_MISSING_DELIVERY',
        severity: 'warn',
        message: 'L2 round has no question probing delivery, planning, or stakeholder handling.',
        repairHint: 'Include at least one L2 question about planning, prioritisation, stakeholder communication, or handling delays.',
      });
    }
  }

  return findings;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function inspectQuestionSet(qs: QuestionSet, ctx: GuardrailContext): Finding[] {
  const findings: Finding[] = [
    ...checkStructure(qs, ctx),
    ...checkCategories(qs, ctx),
    ...checkDuplicates(qs),
    ...checkRoundCalibration(qs, ctx),
  ];

  for (const q of qs.questions) {
    findings.push(...checkRubric(q), ...checkContent(q));
  }

  return findings;
}

export function blockingFindings(findings: Finding[]): Finding[] {
  return findings.filter((f) => f.severity === 'error');
}

export function hasBlockingFindings(findings: Finding[]): boolean {
  return findings.some((f) => f.severity === 'error');
}

/** Compact instruction block appended to a repair prompt. */
export function formatFindingsForRepair(findings: Finding[]): string {
  return findings
    .map((f) => `- [${f.code}]${f.questionId ? ` (question "${f.questionId}")` : ''} ${f.message} FIX: ${f.repairHint}`)
    .join('\n');
}

/** One-line human summary for logs and error messages. */
export function summarizeFindings(findings: Finding[]): string {
  if (findings.length === 0) return 'no issues';
  const counts = new Map<string, number>();
  for (const f of findings) counts.set(f.code, (counts.get(f.code) ?? 0) + 1);
  return [...counts.entries()].map(([code, n]) => (n > 1 ? `${code}×${n}` : code)).join(', ');
}
