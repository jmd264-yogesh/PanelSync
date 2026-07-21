import { feedbackRepository } from '@server/repositories/feedback/feedback.repository';

export class FeedbackService {
  private repository = feedbackRepository;

  async getInterviewByToken(token: string) {
    const result = await this.repository.getInterviewByPanelToken(token);
    if (!result) {
      throw new Error('Invalid or expired token');
    }
    return result;
  }

  async submitFeedback(token: string, feedback: string | undefined, decision: string) {
    // Validate decision
    if (!decision || !['PASSED', 'REJECTED'].includes(decision)) {
      throw new Error('decision must be PASSED or REJECTED');
    }

    const result = await this.repository.getInterviewByPanelToken(token);
    if (!result) {
      throw new Error('Invalid or expired token');
    }

    const { panel, interview } = result;

    // Enforce: interview must be SCHEDULED before feedback can be submitted
    if (interview.status !== 'SCHEDULED') {
      throw new Error('Feedback can only be submitted after the interview is scheduled.');
    }

    // Check 2-hour edit window if already submitted
    if (panel.status === 'SUBMITTED' && panel.submittedAt) {
      const elapsedMs = Date.now() - new Date(panel.submittedAt).getTime();
      if (elapsedMs > 2 * 60 * 60 * 1000) {
        throw new Error('The 2-hour feedback editing window has expired.');
      }
    }

    // Submit feedback
    await this.repository.submitPanelFeedback(panel.id, feedback || '', decision as 'PASSED' | 'REJECTED');

    // Auto-update candidate outcome status
    try {
      await this.updateCandidateOutcome(panel.interviewId, decision as 'PASSED' | 'REJECTED');
    } catch (err) {
      console.error('Auto-outcome update failed:', err);
    }

    return { success: true };
  }

  private async updateCandidateOutcome(interviewId: string, decision: 'PASSED' | 'REJECTED') {
    const interview = await this.repository.getInterviewById(interviewId);
    if (!interview) return;

    const candidate = await this.repository.getCandidateByInterviewId(interview.id);
    if (!candidate) return;

    const isL1 = interview.role.toLowerCase().includes('l1');
    const isL2 = interview.role.toLowerCase().includes('l2');

    let nextOutcomeStatus = candidate.outcomeStatus;
    let nextQueueStatus = 'MAPPED';
    let nextMappedInterviewId: string | null = interview.id;

    if (isL1) {
      if (decision === 'PASSED') {
        nextOutcomeStatus = 'PASSED_L1';
        nextQueueStatus = 'WAITING';
        nextMappedInterviewId = null;
      } else {
        nextOutcomeStatus = 'REJECTED';
      }
    } else if (isL2) {
      nextOutcomeStatus = decision === 'PASSED' ? 'PASSED_L2' : 'REJECTED';
    } else {
      nextOutcomeStatus = decision === 'PASSED' ? 'PASSED_L1' : 'REJECTED';
    }

    await this.repository.updateCandidateOutcome(
      candidate.id,
      nextOutcomeStatus,
      nextQueueStatus,
      nextMappedInterviewId
    );

    if (nextQueueStatus === 'WAITING') {
      await this.repository.autoMapPendingCandidates();
    }
  }
}

export const feedbackService = new FeedbackService();
