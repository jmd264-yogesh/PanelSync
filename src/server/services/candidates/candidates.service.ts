import crypto from 'crypto';
import { candidatesRepository } from '@server/repositories/candidates/candidates.repository';
import { blob } from '@server/lib/blob';
import { validateResumeFile, InvalidResumeFileError } from '@server/util/file-validate';
import { fetchExternalResume } from '@server/util/fetch-external-resume';
import { graph, isOneDriveOrSharePointUrl } from '@server/lib/graph';
import { db } from '@server/lib/db';

interface BulkUploadCandidate {
  name: string;
  email: string;
  preferredDate: string;
  college: string;
  collegeDrive: string;
  resumeLink?: string;
}

interface ResumeLinkFailure {
  name: string;
  email: string;
  error: string;
}

export class CandidatesService {
  private repository = candidatesRepository;

  async getCandidates() {
    return this.repository.getAll();
  }

  async deleteCandidate(id: string) {
    await this.repository.delete(id);
    return this.repository.getAll();
  }

  async updateCandidate(id: string, updates: any) {
    if ('outcomeStatus' in updates) {
      await this.repository.updateOutcome(id, updates.outcomeStatus);
    } else {
      // Validate required fields
      const updateParams: any = {};

      if (updates.name !== undefined) {
        if (!updates.name.trim()) throw new Error('Candidate name is required.');
        updateParams.name = updates.name;
      }
      if (updates.email !== undefined) {
        if (!updates.email.trim()) throw new Error('Candidate email is required.');
        updateParams.email = updates.email;
      }
      if (updates.preferredDate !== undefined) {
        if (!updates.preferredDate.trim()) throw new Error('Drive Date is required.');
        updateParams.preferredDate = updates.preferredDate;
      }
      if (updates.college !== undefined) {
        if (!updates.college.trim()) throw new Error('College Name of Candidate is required.');
        updateParams.college = updates.college;
      }
      if (updates.collegeDrive !== undefined) {
        if (!updates.collegeDrive.trim()) throw new Error('College Name of Drive is required.');
        updateParams.collegeDrive = updates.collegeDrive;
      }

      if (Object.keys(updateParams).length > 0) {
        await this.repository.update(id, updateParams);
      }
    }

    return this.repository.getAll();
  }

  async uploadResume(candidateId: string, file: File, userEmail: string) {
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
    await this.repository.addAuditLog(userEmail, 'RESUME_UPLOADED', 'UploadedCandidate', candidateId, { sha256 });

    return this.repository.getAll();
  }

  async unmapCandidate(id: string) {
    const unmapped = await this.repository.unmap(id);
    if (!unmapped) {
      throw new Error('Candidate is not currently mapped to an interview.');
    }

    const [candidates, interviews] = await Promise.all([
      this.repository.getAll(),
      db.getInterviews(),
    ]);

    return { candidates, interviews };
  }

  async bulkUploadCandidates(
    candidates: BulkUploadCandidate[],
    accessToken: string,
    userEmail: string
  ) {
    // Validate candidates array
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      throw new Error('Invalid or empty candidates list');
    }

    // Validate each candidate's required fields
    this.validateCandidates(candidates);

    // 1. Add candidates to database
    const created = await this.repository.create(candidates);

    // 2. Attach resume links if provided
    const resumeLinkFailures = await this.attachResumeLinks(
      candidates,
      created,
      accessToken,
      userEmail
    );

    // 3. Trigger auto-mapping immediately
    const mapRes = await this.repository.autoMap({ token: accessToken, email: userEmail });

    // 4. Fetch updated states
    const [updatedCandidates, updatedInterviews] = await Promise.all([
      this.repository.getAll(),
      db.getInterviews(),
    ]);

    return {
      candidates: updatedCandidates,
      interviews: updatedInterviews,
      mappedCount: mapRes.mappedCount,
      resumeLinkFailures,
    };
  }

  private validateCandidates(candidates: BulkUploadCandidate[]) {
    for (const c of candidates) {
      if (!c.name || !c.name.trim()) {
        throw new Error('Candidate name is required for all candidates.');
      }
      if (!c.email || !c.email.trim()) {
        throw new Error(`Candidate email is required for ${c.name || 'all candidates'}.`);
      }
      if (!c.preferredDate || !c.preferredDate.trim()) {
        throw new Error(`Drive Date is required for candidate "${c.name}".`);
      }
      if (!c.college || !c.college.trim()) {
        c.college = c.collegeDrive;
      }
      if (!c.college || !c.college.trim()) {
        throw new Error(`College Name of Candidate is required for candidate "${c.name}".`);
      }
      if (!c.collegeDrive || !c.collegeDrive.trim()) {
        throw new Error(`College Name of Drive is required for candidate "${c.name}".`);
      }
    }
  }

  private async attachResumeLinks(
    candidates: BulkUploadCandidate[],
    created: any[],
    accessToken: string,
    userEmail: string
  ): Promise<ResumeLinkFailure[]> {
    const failures: ResumeLinkFailure[] = [];

    for (const c of candidates) {
      if (!c.resumeLink || !c.resumeLink.trim()) continue;

      const match = created.find((row) => row.email.toLowerCase() === c.email.toLowerCase());
      if (!match) continue;

      try {
        const link = c.resumeLink.trim();
        let buffer: Buffer;

        if (isOneDriveOrSharePointUrl(link)) {
          // Resolve via Graph using the recruiter's delegated access
          const { downloadUrl } = await graph.resolveSharedFile(link, accessToken);
          const res = await fetch(downloadUrl);
          if (!res.ok) throw new Error(`Failed to download OneDrive file (status ${res.status}).`);
          buffer = Buffer.from(await res.arrayBuffer());
        } else {
          buffer = await fetchExternalResume(link);
        }

        const { contentType } = validateResumeFile(buffer);
        const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
        const { fileKey } = await blob.uploadResume(match.id, buffer, 'resume', contentType);

        await this.repository.setResume(match.id, { fileKey, sha256 });
        await this.repository.addAuditLog(userEmail, 'RESUME_UPLOADED', 'UploadedCandidate', match.id, {
          sha256,
          source: 'bulk_link',
        });
      } catch (err) {
        failures.push({
          name: c.name,
          email: c.email,
          error: err instanceof Error ? err.message : 'Failed to attach resume link.',
        });
      }
    }

    return failures;
  }
}

export const candidatesService = new CandidatesService();
