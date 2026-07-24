/**
 * Round Result Calculation Utility
 *
 * Computes L1 and L2 interview round results for candidates based on their
 * interviews and panel decisions.
 */

import type { UploadedCandidate, Interview } from '@server/lib/db';
import type { CandidateRoundResults } from '@/common/types/candidate';
import type { RoundResult } from '@/common/constants/candidateStatus';

/**
 * Get the status of a specific round (L1 or L2) for a candidate
 */
function getRoundStatus(
  roundInterviews: Interview[],
  roundName: 'L1' | 'L2',
  candidate: UploadedCandidate
): RoundResult {
  if (roundInterviews.length === 0) {
    const os = candidate.outcomeStatus;
    if (roundName === 'L1') {
      if (os === 'PASSED_L1' || os === 'PASSED_L2' || os === 'SELECTED') {
        return 'Passed';
      }
      if (os === 'REJECTED') {
        return 'Rejected';
      }
      return 'Not Started';
    } else {
      // L2
      if (os === 'PASSED_L2' || os === 'SELECTED') {
        return 'Passed';
      }
      if (os === 'REJECTED' && candidate.outcomeStatus === 'PASSED_L1') {
        return 'Rejected';
      }
      return 'Not Started';
    }
  }

  const latestInterview = [...roundInterviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0];

  if (latestInterview.status === 'CANCELLED') {
    return 'Cancelled';
  }

  const panels = latestInterview.panels || [];
  const submittedPanels = panels.filter((p) => p.status === 'SUBMITTED');

  if (submittedPanels.length > 0) {
    const hasRejected = submittedPanels.some((p) => p.decision === 'REJECTED');
    if (hasRejected) {
      return 'Rejected';
    }
    const hasPassed = submittedPanels.some((p) => p.decision === 'PASSED');
    if (hasPassed) {
      return 'Passed';
    }
  }

  if (latestInterview.status === 'SCHEDULED') {
    return 'Pending Feedback';
  }

  return 'Scheduled';
}

/**
 * Compute L1 & L2 round results for a candidate
 *
 * @param candidate - The candidate to compute results for
 * @param interviews - All interviews in the system
 * @returns Object with l1Result and l2Result
 */
export function getCandidateRoundResults(
  candidate: UploadedCandidate,
  interviews: Interview[]
): CandidateRoundResults {
  const candidateInterviews = interviews.filter(
    (i) => i.candidateEmail.toLowerCase() === candidate.email.toLowerCase()
  );

  const l1Interviews = candidateInterviews.filter((i) =>
    i.role.toLowerCase().includes('l1')
  );
  const l2Interviews = candidateInterviews.filter((i) =>
    i.role.toLowerCase().includes('l2')
  );

  let l1Result = getRoundStatus(l1Interviews, 'L1', candidate);
  let l2Result = getRoundStatus(l2Interviews, 'L2', candidate);

  const os = candidate.outcomeStatus;
  if (os === 'PASSED_L1') {
    l1Result = 'Passed';
  } else if (os === 'PASSED_L2' || os === 'SELECTED') {
    l1Result = 'Passed';
    l2Result = 'Passed';
  } else if (os === 'REJECTED') {
    const hasL2Rejected = l2Interviews.some((i) =>
      i.panels.some((p) => p.decision === 'REJECTED')
    );
    const hasL1Rejected = l1Interviews.some((i) =>
      i.panels.some((p) => p.decision === 'REJECTED')
    );

    if (hasL2Rejected) {
      l1Result = 'Passed';
      l2Result = 'Rejected';
    } else if (hasL1Rejected) {
      l1Result = 'Rejected';
      l2Result = 'Not Started';
    } else {
      if (l2Interviews.length > 0) {
        l1Result = 'Passed';
        l2Result = 'Rejected';
      } else {
        l1Result = 'Rejected';
        l2Result = 'Not Started';
      }
    }
  }

  return { l1Result, l2Result };
}
