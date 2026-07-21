import crypto from 'crypto';
import { lateralCandidatesRepository } from '@server/repositories/lateral-candidates/lateral-candidates.repository';
import { ROLE_GRADES } from '@server/services/ai/spec-catalog';
import { blob } from '@server/lib/blob';
import { validateResumeFile, InvalidResumeFileError } from '@server/util/file-validate';

const VALID_STATUSES = ['NEW', 'SCREENING', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED', 'WITHDRAWN'];

interface LateralCandidateData {
  name: string;
  email: string;
  phone?: string;
  positionTitle: string;
  experienceYears?: number;
  currentCompany?: string;
  currentCtc?: string;
  expectedCtc?: string;
  noticePeriodDays?: number;
  source?: string;
  roleGrade?: string;
}

export class LateralCandidatesService {
  private repository = lateralCandidatesRepository;

  async getLateralCandidates() {
    return this.repository.getAll();
  }

  async addLateralCandidate(data: LateralCandidateData) {
    // Validate required fields
    if (!data.name || !data.name.trim()) {
      throw new Error('Candidate name is required.');
    }
    if (!data.email || !data.email.trim()) {
      throw new Error('Candidate email is required.');
    }
    if (!data.positionTitle || !data.positionTitle.trim()) {
      throw new Error('Position title is required.');
    }

    // Validate roleGrade if provided
    if (data.roleGrade !== undefined && data.roleGrade !== '' && !(data.roleGrade in ROLE_GRADES)) {
      throw new Error(`roleGrade must be one of: ${Object.keys(ROLE_GRADES).join(', ')}`);
    }

    const candidateData = {
      name: data.name.trim(),
      email: data.email.trim(),
      phone: data.phone?.trim() || undefined,
      positionTitle: data.positionTitle.trim(),
      experienceYears: data.experienceYears !== undefined && (data.experienceYears as any) !== '' ? Number(data.experienceYears) : undefined,
      currentCompany: data.currentCompany?.trim() || undefined,
      currentCtc: data.currentCtc?.trim() || undefined,
      expectedCtc: data.expectedCtc?.trim() || undefined,
      noticePeriodDays: data.noticePeriodDays !== undefined && (data.noticePeriodDays as any) !== '' ? Number(data.noticePeriodDays) : undefined,
      source: data.source?.trim() || undefined,
      roleGrade: data.roleGrade?.trim() || undefined,
    };

    await this.repository.create(candidateData);
    return this.repository.getAll();
  }

  async updateLateralCandidate(id: string, updates: any) {
    if (!id) {
      throw new Error('Missing candidate ID');
    }

    const updateParams: any = {};

    // Validate and prepare updates
    if (updates.name !== undefined) {
      if (!updates.name.trim()) throw new Error('Candidate name is required.');
      updateParams.name = updates.name.trim();
    }
    if (updates.email !== undefined) {
      if (!updates.email.trim()) throw new Error('Candidate email is required.');
      updateParams.email = updates.email.trim();
    }
    if (updates.positionTitle !== undefined) {
      if (!updates.positionTitle.trim()) throw new Error('Position title is required.');
      updateParams.positionTitle = updates.positionTitle.trim();
    }
    if (updates.phone !== undefined) updateParams.phone = updates.phone?.trim() || null;
    if (updates.experienceYears !== undefined) updateParams.experienceYears = updates.experienceYears === '' ? null : Number(updates.experienceYears);
    if (updates.currentCompany !== undefined) updateParams.currentCompany = updates.currentCompany?.trim() || null;
    if (updates.currentCtc !== undefined) updateParams.currentCtc = updates.currentCtc?.trim() || null;
    if (updates.expectedCtc !== undefined) updateParams.expectedCtc = updates.expectedCtc?.trim() || null;
    if (updates.noticePeriodDays !== undefined) updateParams.noticePeriodDays = updates.noticePeriodDays === '' ? null : Number(updates.noticePeriodDays);
    if (updates.source !== undefined) updateParams.source = updates.source?.trim() || null;

    if (updates.roleGrade !== undefined) {
      const trimmed = updates.roleGrade?.trim() || '';
      if (trimmed && !(trimmed in ROLE_GRADES)) {
        throw new Error(`roleGrade must be one of: ${Object.keys(ROLE_GRADES).join(', ')}`);
      }
      updateParams.roleGrade = trimmed || null;
    }

    if (updates.status !== undefined) {
      if (!VALID_STATUSES.includes(updates.status)) {
        throw new Error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      updateParams.status = updates.status;
    }

    await this.repository.update(id, updateParams);
    return this.repository.getAll();
  }

  async deleteLateralCandidate(id: string) {
    if (!id) {
      throw new Error('Missing candidate ID');
    }

    await this.repository.delete(id);
    return this.repository.getAll();
  }

  async uploadResume(candidateId: string, file: File, userEmail: string) {
    if (!candidateId) {
      throw new Error('Missing candidate ID');
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let contentType: string;
    try {
      ({ contentType } = validateResumeFile(buffer));
    } catch (err) {
      if (err instanceof InvalidResumeFileError) {
        throw err;
      }
      throw err;
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const { fileKey } = await blob.uploadResume(candidateId, buffer, file.name, contentType);

    await this.repository.setResume(candidateId, { fileKey, sha256 });
    await this.repository.addAuditLog(userEmail, 'RESUME_UPLOADED', 'LateralCandidate', candidateId, { sha256 });

    return this.repository.getAll();
  }

  async getRecalibrateReport(id: string) {
    const candidate = await this.repository.getById(id);
    if (!candidate) {
      throw new Error('Candidate not found');
    }
    if (!candidate.mappedInterviewId) {
      throw new Error('No interview scheduled for this candidate yet.');
    }

    const recalibrateSession = await this.repository.getRecalibrateSession(candidate.mappedInterviewId);
    if (!recalibrateSession || !recalibrateSession.submittedAt) {
      throw new Error('This candidate has no submitted Recalibrate assessment yet.');
    }

    const aiRun = recalibrateSession.aiRunId ? await this.repository.getAiRun(recalibrateSession.aiRunId) : null;

    return {
      candidateName: candidate.name,
      positionTitle: candidate.positionTitle,
      session: recalibrateSession,
      spec: aiRun?.spec ?? null,
      questions: aiRun?.questions ?? null,
    };
  }
}

export const lateralCandidatesService = new LateralCandidatesService();
