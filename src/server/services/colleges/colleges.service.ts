import { collegesRepository } from '@server/repositories/colleges/colleges.repository';

export class CollegesService {
  private repository = collegesRepository;

  async getColleges() {
    return this.repository.getAll();
  }

  async addCollege(name: string) {
    // Validate college name
    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new Error('College name is required');
    }

    try {
      await this.repository.add(name);
      return { success: true, name: name.trim() };
    } catch (error: any) {
      throw new Error(error.message || 'Database error adding college');
    }
  }

  async deleteCollege(id: string) {
    if (!id) {
      throw new Error('Missing college ID');
    }

    try {
      await this.repository.delete(id);
      return { success: true };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete college');
    }
  }
}

export const collegesService = new CollegesService();
