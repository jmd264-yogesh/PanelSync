import { db, dbClient } from '@server/lib/db';
import * as schema from '@server/lib/schema';
import { eq } from 'drizzle-orm';

export class FeedbackRepository {
  async getInterviewByPanelToken(token: string) {
    return db.getInterviewByPanelToken(token);
  }

  async submitPanelFeedback(panelId: string, feedback: string, decision: 'PASSED' | 'REJECTED') {
    return db.submitPanelFeedback(panelId, feedback, decision);
  }

  async getInterviewById(interviewId: string) {
    const [interview] = await dbClient
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.id, interviewId))
      .limit(1);
    return interview || null;
  }

  async getCandidateByInterviewId(interviewId: string) {
    const [candidate] = await dbClient
      .select()
      .from(schema.uploadedCandidates)
      .where(eq(schema.uploadedCandidates.mappedInterviewId, interviewId))
      .limit(1);
    return candidate || null;
  }

  async updateCandidateOutcome(
    candidateId: string,
    outcomeStatus: string,
    status: string,
    mappedInterviewId: string | null
  ) {
    return dbClient
      .update(schema.uploadedCandidates)
      .set({ outcomeStatus, status, mappedInterviewId })
      .where(eq(schema.uploadedCandidates.id, candidateId));
  }

  async autoMapPendingCandidates() {
    return db.autoMapPendingCandidates();
  }
}

export const feedbackRepository = new FeedbackRepository();
