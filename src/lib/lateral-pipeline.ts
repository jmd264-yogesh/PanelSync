// The lateral hiring pipeline — single source of truth for candidate stages.
//
// This exists because the stage list had drifted into three different shapes: the UI
// dropdown offered 9 options, the PATCH route accepted 7 (a different 7), and the type
// in db.ts listed yet another set. Three of the dropdown's options were silently
// rejected with a 400, and one value the API accepted was never offered anywhere. Every
// consumer now imports from here, so a stage added in one place is valid everywhere.
//
// The stages mirror the actual process — L1, L2, Manager — rather than generic
// "interviewing" states, because "which round are they in" is the question recruiters
// are actually asking of this column.

export const LATERAL_STAGES = [
  'NEW',
  'L1',
  'L2',
  'MANAGER',
  'OFFERED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
] as const;

export type LateralStage = (typeof LATERAL_STAGES)[number];

export const STAGE_LABEL: Record<LateralStage, string> = {
  NEW: 'New',
  L1: 'L1 Round',
  L2: 'L2 Round',
  MANAGER: 'Manager Round',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export interface StageStyle {
  bg: string;
  border: string;
  color: string;
}

// L1/L2 deliberately reuse the app-wide badge tokens so a candidate's stage reads the
// same colour as the round badges shown everywhere else (scheduling modal, Recalibrate
// rail, interviews column).
export const STAGE_STYLE: Record<LateralStage, StageStyle> = {
  NEW: { bg: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)', color: '#94a3b8' },
  L1: { bg: 'var(--badge-l1-bg)', border: '1px solid var(--badge-l1-border)', color: 'var(--badge-l1-text)' },
  L2: { bg: 'var(--badge-l2-bg)', border: '1px solid var(--badge-l2-border)', color: 'var(--badge-l2-text)' },
  MANAGER: { bg: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#6366f1' },
  OFFERED: { bg: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' },
  HIRED: { bg: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' },
  REJECTED: { bg: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' },
  WITHDRAWN: { bg: 'rgba(107,114,128,0.1)', border: '1px solid rgba(107,114,128,0.25)', color: '#6b7280' },
};

/** Stages a candidate can still progress from. */
export const ACTIVE_STAGES: readonly LateralStage[] = ['NEW', 'L1', 'L2', 'MANAGER', 'OFFERED'];

export function isLateralStage(value: unknown): value is LateralStage {
  return typeof value === 'string' && (LATERAL_STAGES as readonly string[]).includes(value);
}

// Rows written before this consolidation carry retired values. Rather than run a
// destructive UPDATE over live candidate data, they're normalised on read: an old row
// displays as the nearest current stage, and self-heals the next time someone changes
// it. A one-off UPDATE to collapse them for good is safe to run later, but nothing
// depends on it having happened.
const LEGACY_STAGE_MAP: Record<string, LateralStage> = {
  SCREENING: 'NEW',
  WAITING_FOR_INTERVIEW: 'NEW',
  // These three only tell us an interview exists, not which round — L1 is the safest
  // floor, since every lateral candidate starts there.
  INTERVIEW_SCHEDULED: 'L1',
  INTERVIEW_COMPLETED: 'L1',
  INTERVIEWING: 'L1',
};

export function normalizeStage(raw: string | null | undefined): LateralStage {
  if (isLateralStage(raw)) return raw;
  if (raw && LEGACY_STAGE_MAP[raw]) return LEGACY_STAGE_MAP[raw];
  return 'NEW';
}

/** Stages that represent a finished outcome — never moved automatically. */
const TERMINAL_STAGES: readonly LateralStage[] = ['HIRED', 'REJECTED', 'WITHDRAWN'];

/**
 * Auto-advance for "an interview was just scheduled": move the candidate to the round
 * being scheduled, but only ever forwards, and never out of a finished outcome.
 *
 * Both guards matter in practice. Scheduling a re-run of an L1 shouldn't drag someone
 * already at MANAGER back down the pipeline, and scheduling anything against a REJECTED
 * candidate shouldn't quietly revive them.
 */
export function advanceStage(current: LateralStage, target: LateralStage): LateralStage {
  if (TERMINAL_STAGES.includes(current)) return current;
  const from = LATERAL_STAGES.indexOf(current);
  const to = LATERAL_STAGES.indexOf(target);
  return to > from ? target : current;
}
