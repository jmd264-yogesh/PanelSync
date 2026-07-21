import { db, dbClient } from '@server/lib/db';
import * as schema from '@server/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

export class AvailabilityRepository {
  async submitAvailability(token: string, slots: any[]) {
    return db.submitAvailability(token, slots);
  }

  async getInterviewByPanelToken(token: string) {
    return db.getInterviewByPanelToken(token);
  }

  async bookInterview(interviewId: string, bookingData: any) {
    return db.bookInterview(interviewId, bookingData);
  }

  async getWaitingCandidates() {
    return dbClient
      .select()
      .from(schema.uploadedCandidates)
      .where(and(eq(schema.uploadedCandidates.status, 'WAITING'), isNull(schema.uploadedCandidates.deletedAt)))
      .orderBy(schema.uploadedCandidates.createdAt);
  }

  async claimCandidate(candidateId: string, interviewId: string) {
    return dbClient
      .update(schema.uploadedCandidates)
      .set({ status: 'MAPPED', mappedInterviewId: interviewId })
      .where(and(eq(schema.uploadedCandidates.id, candidateId), eq(schema.uploadedCandidates.status, 'WAITING')))
      .returning({ id: schema.uploadedCandidates.id });
  }

  async updateInterviewCandidate(interviewId: string, candidateName: string, candidateEmail: string) {
    return dbClient
      .update(schema.interviews)
      .set({
        candidateName,
        candidateEmail,
        updatedAt: new Date(),
      })
      .where(eq(schema.interviews.id, interviewId));
  }

  async updatePanelStatus(panelId: string, status: string, submittedAt: Date) {
    return dbClient
      .update(schema.interviewPanels)
      .set({ status, submittedAt })
      .where(eq(schema.interviewPanels.id, panelId));
  }

  async clearPanelAvailabilities(panelId: string) {
    return dbClient
      .delete(schema.panelAvailabilities)
      .where(eq(schema.panelAvailabilities.panelId, panelId));
  }

  async savePanelAvailability(panelId: string, startTime: Date, endTime: Date) {
    return dbClient.insert(schema.panelAvailabilities).values({
      id: crypto.randomUUID(),
      panelId,
      startTime,
      endTime,
    });
  }

  async createInterview(interviewData: any) {
    return dbClient.insert(schema.interviews).values(interviewData);
  }

  async createPanel(panelData: any) {
    return dbClient.insert(schema.interviewPanels).values(panelData);
  }

  async getPanelByToken(token: string) {
    const [panelRow] = await dbClient
      .select()
      .from(schema.interviewPanels)
      .where(eq(schema.interviewPanels.token, token))
      .limit(1);
    return panelRow || null;
  }

  async updatePanelRejection(panelId: string, reason: string) {
    const now = new Date();
    await dbClient
      .update(schema.interviewPanels)
      .set({
        status: 'REJECTED',
        submittedAt: now,
        feedback: reason.trim(),
      })
      .where(eq(schema.interviewPanels.id, panelId));
    return now;
  }

  async touchInterviewUpdatedAt(interviewId: string, updatedAt: Date) {
    return dbClient
      .update(schema.interviews)
      .set({ updatedAt })
      .where(eq(schema.interviews.id, interviewId));
  }

  async getRecruiterCCEmails(email: string) {
    return db.getRecruiterCCEmails(email);
  }
}

export const availabilityRepository = new AvailabilityRepository();
