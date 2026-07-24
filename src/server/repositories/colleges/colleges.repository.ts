import { db } from '@server/lib/db';

export class CollegesRepository {
  async getAll() {
    return db.getColleges();
  }

  async add(name: string) {
    return db.addCollege(name);
  }

  async delete(id: string) {
    return db.deleteCollege(id);
  }
}

export const collegesRepository = new CollegesRepository();
