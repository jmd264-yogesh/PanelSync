/**
 * Candidate Status Constants
 *
 * Defines all status-related constants for the candidate management system.
 */

export const CANDIDATE_STATUS_OPTIONS = ['WAITING', 'MAPPED'] as const;
export type CandidateStatus = typeof CANDIDATE_STATUS_OPTIONS[number];

export const OUTCOME_STATUS_OPTIONS = [
  'PENDING',
  'PASSED_L1',
  'PASSED_L2',
  'SELECTED',
  'REJECTED',
] as const;
export type OutcomeStatus = typeof OUTCOME_STATUS_OPTIONS[number];

export const CANDIDATE_STATUS_LABELS: Record<CandidateStatus, string> = {
  WAITING: 'Waiting',
  MAPPED: 'Mapped',
};

export const OUTCOME_STATUS_LABELS: Record<OutcomeStatus, string> = {
  PENDING: 'Pending',
  PASSED_L1: 'Passed L1',
  PASSED_L2: 'Passed L2',
  SELECTED: 'Selected',
  REJECTED: 'Rejected',
};

export const ROUND_RESULT_OPTIONS = [
  'Not Started',
  'Scheduled',
  'Pending Feedback',
  'Passed',
  'Rejected',
  'Cancelled',
] as const;
export type RoundResult = typeof ROUND_RESULT_OPTIONS[number];
