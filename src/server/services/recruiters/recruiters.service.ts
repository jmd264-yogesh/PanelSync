import { recruitersRepository } from '@server/repositories/recruiters/recruiters.repository';

export class RecruitersService {
  private repository = recruitersRepository;

  async getRecruiters() {
    return this.repository.getAll();
  }

  async addRecruiter(email: string, addedBy: string) {
    // Validate email
    if (!email || typeof email !== 'string' || !email.trim()) {
      throw new Error('Email is required');
    }

    const success = await this.repository.add(email, addedBy);
    if (!success) {
      throw new Error('Recruiter already pre-approved or registered');
    }

    return { success: true, email: email.trim().toLowerCase() };
  }

  async removeRecruiter(email: string) {
    if (!email) {
      throw new Error('Email is required');
    }

    const decodedEmail = decodeURIComponent(email);
    const success = await this.repository.remove(decodedEmail);
    if (!success) {
      throw new Error('Failed to remove recruiter');
    }

    return { success: true };
  }
}

export const recruitersService = new RecruitersService();
