import { drivesRepository } from '@server/repositories/drives/drives.repository';

export class DrivesService {
  private repository = drivesRepository;

  async getDrivesWithActive() {
    const [drives, activeDrive] = await Promise.all([
      this.repository.getAll(),
      this.repository.getActive(),
    ]);
    return { drives, activeDrive };
  }

  async createDrive(collegeName: string, startDate: string, endDate: string) {
    // Validate college name
    if (!collegeName || typeof collegeName !== 'string' || !collegeName.trim()) {
      throw new Error('College name is required');
    }

    // Validate start date
    if (!startDate || typeof startDate !== 'string' || !startDate.trim()) {
      throw new Error('Start date is required');
    }

    // Validate end date
    if (!endDate || typeof endDate !== 'string' || !endDate.trim()) {
      throw new Error('End date is required');
    }

    // Validate date range
    if (endDate.trim() < startDate.trim()) {
      throw new Error('End date cannot be before the start date');
    }

    const newDrive = await this.repository.create(collegeName, startDate, endDate);

    // Auto-activate if drive starts today (Asia/Kolkata timezone)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    if (startDate.trim() === today) {
      await this.repository.setActive(newDrive.id);
    }

    return { success: true, drive: newDrive };
  }

  async deleteDrive(id: string) {
    if (!id) {
      throw new Error('Missing drive ID');
    }

    await this.repository.delete(id);
    return { success: true };
  }

  async updateDriveStatus(id: string, status: string) {
    if (!id) {
      throw new Error('Missing drive ID');
    }

    if (status !== 'OPEN' && status !== 'CLOSED') {
      throw new Error('status must be OPEN or CLOSED');
    }

    await this.repository.setStatus(id, status as 'OPEN' | 'CLOSED');
    return { success: true };
  }

  async setActiveDrive(id: string) {
    if (!id || typeof id !== 'string') {
      throw new Error('Drive ID is required');
    }

    await this.repository.setActive(id);
    const updatedActiveDrive = await this.repository.getActive();
    return { success: true, activeDrive: updatedActiveDrive };
  }
}

export const drivesService = new DrivesService();
