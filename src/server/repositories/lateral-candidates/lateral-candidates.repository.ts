import { db } from '@server/lib/db';

export class LateralCandidatesRepository {
  async getAll() {
    return db.getLateralCandidates();
  }

  async getById(id: string) {
    return db.getLateralCandidate(id);
  }

  async create(data: any) {
    return db.addLateralCandidate(data);
  }

  async update(id: string, updates: any) {
    return db.updateLateralCandidate(id, updates);
  }

  async delete(id: string) {
    return db.deleteLateralCandidate(id);
  }

  async setResume(id: string, resumeData: { fileKey: string; sha256: string }) {
    return db.setLateralCandidateResume(id, resumeData);
  }

  async getRecalibrateSession(interviewId: string) {
    return db.getRecalibrateSession(interviewId);
  }

  async getAiRun(runId: string) {
    return db.getAiRun(runId);
  }

  async addAuditLog(
    userEmail: string,
    action: string,
    entity: string,
    entityId: string,
    metadata: any
  ) {
    return db.addAuditLog(userEmail, action, entity, entityId, metadata);
  }
}

export const lateralCandidatesRepository = new LateralCandidatesRepository();
