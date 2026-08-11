// The eval case table.
//
// Two kinds of case matter equally:
//   - detection: a defective set MUST produce a specific finding code
//   - false positive: a legitimate set MUST NOT produce one
//
// The false-positive cases are the ones that keep the guardrails usable. A safety rule
// that fires on "how do you manage schema changes?" because it contains "manage" would
// get switched off within a week, which is worse than not having it.

import type { QuestionSet } from '../src/lib/ai/schemas';
import type { GuardrailContext } from '../src/lib/ai/guardrails';
import { BASE_CONTEXT, BEHAVIOURAL, TECH_A, mutate, validQuestionSet } from './fixtures';

export interface GuardrailCase {
  name: string;
  questionSet: QuestionSet;
  context: GuardrailContext;
  /** Finding codes that must be present. */
  expectCodes?: string[];
  /** Finding codes that must NOT be present. */
  forbidCodes?: string[];
  /** Whether the set should be rejected outright. */
  expectBlocking: boolean;
}

const ctx = (over: Partial<GuardrailContext> = {}): GuardrailContext => ({ ...BASE_CONTEXT, ...over });

export const GUARDRAIL_CASES: GuardrailCase[] = [
  // ── Happy path ─────────────────────────────────────────────────────────────
  {
    name: 'clean set passes with no blocking findings',
    questionSet: validQuestionSet(),
    context: ctx(),
    expectBlocking: false,
    forbidCodes: [
      'COUNT_MISMATCH', 'UNKNOWN_CATEGORY', 'DUPLICATE_QUESTION', 'RUBRIC_BAND_GAP',
      'MODEL_ANSWER_TOO_SHORT', 'MODEL_ANSWER_FIRST_PERSON', 'DISCRIMINATORY_TOPIC',
      'PII_LEAK', 'PLACEHOLDER_TEXT', 'TRUNCATED_QUESTION', 'CODING_IN_BEHAVIOURAL',
    ],
  },

  // ── Structure ──────────────────────────────────────────────────────────────
  {
    name: 'detects wrong question count',
    questionSet: mutate((qs) => { qs.questions.pop(); }),
    context: ctx(),
    expectCodes: ['COUNT_MISMATCH'],
    expectBlocking: true,
  },
  {
    name: 'detects duplicate question ids',
    questionSet: mutate((qs) => { qs.questions[1].id = qs.questions[0].id; }),
    context: ctx(),
    expectCodes: ['DUPLICATE_ID'],
    expectBlocking: true,
  },
  {
    name: 'detects a category outside the selected set',
    questionSet: mutate((qs) => { qs.questions[0].category = 'Kubernetes Administration'; }),
    context: ctx(),
    expectCodes: ['UNKNOWN_CATEGORY'],
    expectBlocking: true,
  },

  // ── Rubric integrity ───────────────────────────────────────────────────────
  {
    name: 'detects a gap between rubric bands',
    questionSet: mutate((qs) => { qs.questions[0].rubric[1].band = '3-3'; }),
    context: ctx(),
    expectCodes: ['RUBRIC_BAND_GAP'],
    expectBlocking: true,
  },
  {
    name: 'detects rubric bands not reaching maxMarks',
    questionSet: mutate((qs) => { qs.questions[0].maxMarks = 6; }),
    context: ctx(),
    expectCodes: ['RUBRIC_BAND_COVERAGE'],
    expectBlocking: true,
  },
  {
    name: 'detects a descriptive rubric band label instead of a mark range',
    questionSet: mutate((qs) => { qs.questions[0].rubric[0].band = 'Basic'; }),
    context: ctx(),
    expectCodes: ['RUBRIC_BAND_FORMAT'],
    expectBlocking: true,
  },

  // ── Content quality ────────────────────────────────────────────────────────
  {
    name: 'detects near-duplicate questions',
    questionSet: mutate((qs) => { qs.questions[3].question = qs.questions[0].question; }),
    context: ctx(),
    expectCodes: ['DUPLICATE_QUESTION'],
    expectBlocking: true,
  },
  {
    name: 'detects a first-person model answer',
    questionSet: mutate((qs) => {
      qs.questions[0].modelAnswer = 'I would start by opening the query profile, then I would look at the dominant operator and check for spilling before resizing anything at all in the warehouse configuration.';
    }),
    context: ctx(),
    expectCodes: ['MODEL_ANSWER_FIRST_PERSON'],
    expectBlocking: true,
  },
  {
    name: 'detects a model answer too thin to score against',
    questionSet: mutate((qs) => { qs.questions[0].modelAnswer = 'Check the query profile.'; }),
    context: ctx(),
    expectCodes: ['MODEL_ANSWER_TOO_SHORT'],
    expectBlocking: true,
  },
  {
    name: 'detects a missing model answer',
    questionSet: mutate((qs) => { qs.questions[0].modelAnswer = ''; }),
    context: ctx(),
    expectCodes: ['MODEL_ANSWER_MISSING'],
    expectBlocking: true,
  },
  {
    name: 'detects placeholder text left in the output',
    questionSet: mutate((qs) => { qs.questions[1].question = 'Explain how you would optimise [insert scenario here] for a large table workload.'; }),
    context: ctx(),
    expectCodes: ['PLACEHOLDER_TEXT'],
    expectBlocking: true,
  },
  {
    name: 'detects a truncated question',
    questionSet: mutate((qs) => { qs.questions[1].question = 'You need a query that returns each customer alongside their previous order value, over roughly two hundred million rows, and'; }),
    context: ctx(),
    expectCodes: ['TRUNCATED_QUESTION'],
    expectBlocking: true,
  },

  // ── Safety / hiring compliance ─────────────────────────────────────────────
  {
    name: 'blocks a question about family commitments',
    questionSet: mutate((qs) => {
      qs.questions[2].question = 'On-call weeks can be demanding — how would you balance that against your family commitments at home?';
    }),
    context: ctx(),
    expectCodes: ['DISCRIMINATORY_TOPIC'],
    expectBlocking: true,
  },
  {
    name: 'blocks a question about age',
    questionSet: mutate((qs) => { qs.questions[2].question = 'This is a fast-moving team with a young culture — how old are you, and would that suit you?'; }),
    context: ctx(),
    expectCodes: ['DISCRIMINATORY_TOPIC'],
    expectBlocking: true,
  },
  {
    name: 'blocks a question about religious practice',
    questionSet: mutate((qs) => { qs.questions[2].question = 'Our releases sometimes land on weekends — do your religious holidays affect your availability at all?'; }),
    context: ctx(),
    expectCodes: ['DISCRIMINATORY_TOPIC'],
    expectBlocking: true,
  },
  {
    name: 'blocks a discriminatory topic hidden in the model answer',
    questionSet: mutate((qs) => {
      qs.questions[2].modelAnswer = 'A strong answer weighs the options carefully and explains the reasoning clearly. Note for the panelist: probe whether they are planning to have children, since it affects on-call rota planning for the team.';
    }),
    context: ctx(),
    expectCodes: ['DISCRIMINATORY_TOPIC'],
    expectBlocking: true,
  },
  {
    name: 'detects a leaked email address',
    questionSet: mutate((qs) => { qs.questions[0].question = 'Your colleague priya.sharma@acme.com reports the nightly Snowflake load is slow. How would you investigate the regression?'; }),
    context: ctx(),
    expectCodes: ['PII_LEAK'],
    expectBlocking: true,
  },

  // ── False positives: these must stay silent ────────────────────────────────
  {
    name: 'does not flag legitimate use of the words age/manage/family',
    questionSet: mutate((qs) => {
      qs.questions[0].question = 'How would you manage the age of cached partitions across a job family that shares one warehouse, without over-provisioning?';
    }),
    context: ctx(),
    forbidCodes: ['DISCRIMINATORY_TOPIC'],
    expectBlocking: false,
  },
  {
    name: 'does not mistake experience ranges or version numbers for phone numbers',
    questionSet: mutate((qs) => {
      qs.questions[0].question = 'Given a 3-5 year retention policy and Spark 3.5.1 in production, how would you plan the storage tiering for a 200 000 000 row table?';
    }),
    context: ctx(),
    forbidCodes: ['PII_LEAK'],
    expectBlocking: false,
  },
  {
    name: 'does not flag a behavioural question that merely mentions a query',
    questionSet: mutate((qs) => {
      qs.questions[2].question = 'A stakeholder insists a query result is wrong when it is not. How do you work through that disagreement without damaging the relationship?';
    }),
    context: ctx(),
    forbidCodes: ['CODING_IN_BEHAVIOURAL'],
    expectBlocking: false,
  },
  {
    name: 'flags an actual coding request inside a behavioural category',
    questionSet: mutate((qs) => { qs.questions[2].question = 'Write a SQL query that deduplicates the customer table by keeping the most recent row per id.'; }),
    context: ctx(),
    expectCodes: ['CODING_IN_BEHAVIOURAL'],
    expectBlocking: true,
  },

  // ── Round calibration (advisory, must not block) ───────────────────────────
  {
    name: 'warns when an L1 round is stacked with hard questions',
    questionSet: mutate((qs) => { qs.questions.forEach((q) => { q.difficulty = 'hard'; }); }),
    context: ctx({ round: 'L1' }),
    expectCodes: ['DIFFICULTY_SKEW_L1'],
    expectBlocking: false,
  },
  {
    name: 'warns when an L2 round is stacked with easy questions',
    questionSet: mutate((qs) => { qs.questions.forEach((q) => { q.difficulty = 'easy'; }); }),
    context: ctx({ round: 'L2' }),
    expectCodes: ['DIFFICULTY_SKEW_L2'],
    expectBlocking: false,
  },
  {
    name: 'warns when an L2 round never probes delivery or stakeholder handling',
    questionSet: mutate((qs) => {
      // Four genuinely distinct, purely technical questions — distinct enough that
      // duplicate detection stays quiet, so the delivery warning is what's under test.
      const purelyTechnical = [
        'How do clustering keys change pruning behaviour on a wide fact table, and how would you tell whether yours are earning their keep?',
        'Walk through what happens internally when a join spills to remote storage, and which knobs actually change that outcome.',
        'Explain how you would model a slowly changing dimension where late-arriving facts are common.',
        'What causes small-file proliferation in a streaming ingest path, and how would you compact without blocking readers?',
      ];
      qs.questions.forEach((q, i) => {
        q.difficulty = 'hard';
        q.question = purelyTechnical[i];
      });
    }),
    context: ctx({ round: 'L2' }),
    expectCodes: ['L2_MISSING_DELIVERY'],
    forbidCodes: ['DUPLICATE_QUESTION'],
    expectBlocking: false,
  },
  {
    name: 'recognises delivery-flavoured L2 questions and stays quiet',
    questionSet: mutate((qs) => {
      qs.questions.forEach((q) => { q.difficulty = 'hard'; });
      qs.questions[2].question = 'A stakeholder wants the migration two weeks earlier than your estimate allows. How do you renegotiate scope and communicate the timeline risk?';
    }),
    context: ctx({ round: 'L2' }),
    forbidCodes: ['L2_MISSING_DELIVERY'],
    expectBlocking: false,
  },

  // ── Coverage (advisory) ────────────────────────────────────────────────────
  {
    name: 'warns when a selected category gets no questions at all',
    questionSet: mutate((qs) => { qs.questions.forEach((q) => { q.category = TECH_A; }); }),
    context: ctx(),
    expectCodes: ['CATEGORY_NOT_COVERED', 'CATEGORY_IMBALANCE'],
    expectBlocking: false,
  },
  {
    name: 'does not demand coverage it had no room for',
    questionSet: mutate((qs) => {
      qs.questions = qs.questions.slice(0, 2);
      qs.questions[0].category = TECH_A;
      qs.questions[1].category = BEHAVIOURAL;
    }),
    context: ctx({ expectedCount: 2 }),
    forbidCodes: ['CATEGORY_NOT_COVERED'],
    expectBlocking: false,
  },
];

// ── Error classification cases ───────────────────────────────────────────────

export interface ErrorCase {
  name: string;
  error: unknown;
  expectKind: string;
  expectRetryable: boolean;
}

export const ERROR_CASES: ErrorCase[] = [
  {
    name: 'Gemini 503 overload (JSON body in message) is retryable',
    error: new Error('ApiError: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}'),
    expectKind: 'OVERLOADED',
    expectRetryable: true,
  },
  {
    name: 'rate limit is retryable',
    error: Object.assign(new Error('Resource exhausted'), { status: 429 }),
    expectKind: 'RATE_LIMIT',
    expectRetryable: true,
  },
  {
    name: 'generic 500 is retryable',
    error: Object.assign(new Error('Internal error'), { status: 500 }),
    expectKind: 'SERVER',
    expectRetryable: true,
  },
  {
    name: 'network failure is retryable',
    error: new Error('fetch failed'),
    expectKind: 'NETWORK',
    expectRetryable: true,
  },
  {
    name: 'bad API key is NOT retryable',
    error: Object.assign(new Error('API key not valid'), { status: 401 }),
    expectKind: 'AUTH',
    expectRetryable: false,
  },
  {
    name: 'malformed request is NOT retryable',
    error: Object.assign(new Error('Invalid argument'), { status: 400 }),
    expectKind: 'BAD_REQUEST',
    expectRetryable: false,
  },
];
