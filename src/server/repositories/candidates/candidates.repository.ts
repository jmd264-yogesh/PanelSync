import { db } from '@server/lib/db';

export class CandidatesRepository {
  async getAll() {
    return db.getUploadedCandidates();
  }

  async create(candidates: any[]) {
    return db.addUploadedCandidates(candidates);
  }

  async delete(id: string) {
    return db.deleteUploadedCandidate(id);
  }

  async update(id: string, updates: any) {
    return db.updateCandidate(id, updates);
  }

  async updateOutcome(id: string, outcomeStatus: string) {
    return db.updateCandidateOutcome(id, outcomeStatus);
  }

  async setResume(id: string, resumeData: { fileKey: string; sha256: string }) {
    return db.setCandidateResume(id, resumeData);
  }

  async unmap(id: string) {
    return db.unmapCandidate(id);
  }

  async autoMap(params: { token: string; email: string }) {
    return db.autoMapPendingCandidates(params);
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

export const candidatesRepository = new CandidatesRepository();
