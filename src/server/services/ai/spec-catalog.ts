import { Question } from './schemas';

// Catalog for the spec-driven ("no resume needed") AI question generation flow.
// Role grades + calibration text + question style are the only "catalog" left here —
// the category taxonomy (what to ask about, and the Overall Scoring Rubric's
// dimensions/bands) now comes entirely from the organization's actual rubric in
// ./org-rubric.ts, keyed off roleGrade.

export const ROLE_GRADES = {
  intern: { label: 'Intern', tier: 1 },
  se: { label: 'Software Engineer', tier: 1 },
  sse: { label: 'Senior Software Engineer', tier: 2 },
  enabler: { label: 'Enabler', tier: 2 },
  sc: { label: 'Solution Consultant', tier: 3 },
  ssc: { label: 'Senior Solution Consultant', tier: 3 },
  architect: { label: 'Data Architect', tier: 4 },
} as const;
export type RoleGrade = keyof typeof ROLE_GRADES;

export const CALIBRATION: Record<number, string> = {
  1: "Tier 1 (Intern / Software Engineer): expect solid fundamentals and clear reasoning under guidance. Don't penalize for lacking a full production-scale answer — look for a sound approach and willingness to say 'I'd check X' rather than a memorized answer.",
  2: 'Tier 2 (Senior Software Engineer / Enabler): expect independent, end-to-end ownership with minimal prompting, plus early signs of mentoring or explaining decisions to others.',
  3: 'Tier 3 (Solution Consultant / Senior Solution Consultant): expect credible client-facing reasoning — translating technical trade-offs into business impact and holding their own with a skeptical stakeholder.',
  4: 'Tier 4 (Data Architect): expect strategic, cross-engagement thinking, comfort defending a recommendation under scrutiny, and awareness of second-order organizational consequences, not just technical correctness.',
};

export const STYLES = {
  foundational: {
    label: 'Logical / Foundational',
    hint: 'Tests core reasoning and fundamentals — the concepts a solid engineer should hold regardless of platform. Cleaner, more self-contained questions with a definable good answer.',
    promptGuidance:
      'Test core reasoning and fundamentals — the concepts a solid practitioner should hold regardless of platform (data modelling logic, SQL/query reasoning, pipeline principles, trade-off thinking, or the relevant fundamentals for the category). Keep it clean and self-contained, with a definable "good answer" — this is about depth of understanding, not obscure trivia. Still reward reasoning over recall: prefer "why / how would you decide" over "define X".',
  },
  practical: {
    label: 'Practical / Real-world',
    hint: 'Messy, forum-style situations that often have no clean answer — surfaces whether the candidate has actually hit these and has a pragmatic or uncommon workaround.',
    promptGuidance:
      'Base questions on genuinely messy, real-world problems practitioners actually report and complain about (the sort of thing found in Stack Overflow threads, community Slack channels, Reddit, and GitHub issues). Favour edge cases and "gotchas": undocumented behaviour, silent failures, tooling quirks, non-obvious performance cliffs. The goal is to find out whether the candidate has actually hit this in real work and has a pragmatic or uncommon workaround — not whether they can recite theory. It is fine if the problem has no perfect solution.',
  },
} as const;
export type Style = keyof typeof STYLES;

const DIFFICULTY_RANK: Record<Question['difficulty'], number> = { easy: 0, medium: 1, hard: 2 };

// Stable sort easy -> hard, mirroring the Calibrate prototype's own client-side ordering
// so the interview warms the candidate up before stretching them.
export function sortByDifficulty(questions: Question[]): Question[] {
  return questions
    .map((q, i) => ({ q, i }))
    .sort((a, b) => (DIFFICULTY_RANK[a.q.difficulty] - DIFFICULTY_RANK[b.q.difficulty]) || (a.i - b.i))
    .map((o) => o.q);
}
