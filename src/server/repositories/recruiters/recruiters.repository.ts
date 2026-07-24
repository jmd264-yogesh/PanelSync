import { db } from '@server/lib/db';

export class RecruitersRepository {
  async getAll() {
    return db.getAllowedRecruiters();
  }

  async add(email: string, addedBy: string) {
    return db.addAllowedRecruiter(email, addedBy);
  }

  async remove(email: string) {
    return db.removeAllowedRecruiter(email);
  }
}

export const recruitersRepository = new RecruitersRepository();
