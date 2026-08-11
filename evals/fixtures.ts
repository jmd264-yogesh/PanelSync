// Builders for eval inputs.
//
// Everything starts from a known-good question set and gets mutated to inject exactly
// one defect, so a failing case points at one guardrail rather than a soup of them.

import type { Question, QuestionSet } from '../src/lib/ai/schemas';
import type { GuardrailContext } from '../src/lib/ai/guardrails';

export const TECH_A = 'Snowflake Experience';
export const TECH_B = 'SQL Proficiency';
export const BEHAVIOURAL = 'Logical Thinking & Problem Solving';

export const BASE_CONTEXT: GuardrailContext = {
  expectedCount: 4,
  allowedCategories: [TECH_A, TECH_B, BEHAVIOURAL],
  behaviouralCategories: [BEHAVIOURAL],
  round: null,
};

export function makeQuestion(overrides: Partial<Question> = {}): Question {
  const base: Question = {
    id: 'q1',
    category: TECH_A,
    question: 'A nightly Snowflake load has started taking three times longer with no change in row count. How would you work out where the time is going, and what would you change first?',
    intent: 'Checks whether the candidate can diagnose warehouse sizing and query pruning issues rather than guessing.',
    linkedResumeEvidence: null,
    difficulty: 'medium',
    maxMarks: 4,
    modelAnswer: 'A strong answer starts from QUERY_HISTORY and the query profile to find the dominant operator rather than guessing. It should identify partition pruning, spilling to remote storage, and warehouse sizing as the usual causes, and explain why simply scaling the warehouse up treats the symptom rather than the cause.',
    rubric: [
      { band: '0-1', description: 'Guesses at causes with no diagnostic method.', exampleSignals: ['Suggests resizing immediately'] },
      { band: '2-3', description: 'Names the query profile but cannot interpret spilling or pruning.', exampleSignals: ['Mentions clustering vaguely'] },
      { band: '4-4', description: 'Diagnoses from the profile and explains the pruning/spilling trade-off.', exampleSignals: ['Reads operator-level timings'] },
    ],
    followUps: ['What would you check before resizing the warehouse?'],
  };
  return { ...base, ...overrides };
}

/** Four distinct, clean questions spanning both technical categories and the behavioural one. */
export function validQuestionSet(): QuestionSet {
  const questions: Question[] = [
    makeQuestion({ id: 'q1' }),
    makeQuestion({
      id: 'q2',
      category: TECH_B,
      difficulty: 'hard',
      question: 'You need a query that returns each customer alongside their previous order value, over roughly two hundred million rows. How would you write it, and what would you watch for at that scale?',
      intent: 'Tests window function fluency and awareness of cost at scale.',
      modelAnswer: 'A strong answer reaches for LAG over a partition by customer ordered by date, rather than a self-join. It should explain why the self-join degrades at this volume, and mention that the partitioning column choice drives the shuffle cost.',
    }),
    makeQuestion({
      id: 'q3',
      category: BEHAVIOURAL,
      difficulty: 'medium',
      question: 'You are midway through a data migration when you realise the source system has been silently dropping records for weeks. What do you do, and in what order?',
      intent: 'Tests prioritisation and escalation judgement under pressure.',
      modelAnswer: 'A strong answer stops the propagation of bad data before anything else, then quantifies the blast radius before communicating. It should show the candidate escalating to stakeholders with an assessment rather than a bare alarm, and proposing a backfill plan with validation.',
    }),
    makeQuestion({
      id: 'q4',
      category: TECH_A,
      difficulty: 'easy',
      question: 'What is the practical difference between a transient table and a permanent table in Snowflake, and when would you reach for each?',
      intent: 'Checks baseline familiarity with storage cost trade-offs.',
      modelAnswer: 'A strong answer explains that transient tables skip fail-safe storage and therefore cost less, at the price of recoverability. It should tie the choice to the data\'s reproducibility — staging data that can be rebuilt is a good fit, and finance-of-record data is not.',
    }),
  ];
  return {
    questions,
    totalMarks: questions.reduce((sum, q) => sum + q.maxMarks, 0),
    coverageNotes: 'Covers Snowflake operations, SQL at scale, and judgement under pressure.',
  };
}

/** Applies a mutation to a fresh copy so cases never share state. */
export function mutate(fn: (qs: QuestionSet) => void): QuestionSet {
  const qs: QuestionSet = JSON.parse(JSON.stringify(validQuestionSet()));
  fn(qs);
  return qs;
}
