import { db } from '@server/lib/db';

export class DrivesRepository {
  async getAll() {
    return db.getDrives();
  }

  async getActive() {
    return db.getActiveDrive();
  }

  async create(collegeName: string, startDate: string, endDate: string) {
    return db.createDrive(collegeName, startDate, endDate);
  }

  async delete(id: string) {
    return db.deleteDrive(id);
  }

  async setStatus(id: string, status: 'OPEN' | 'CLOSED') {
    return db.setDriveStatus(id, status);
  }

  async setActive(id: string) {
    return db.setActiveDrive(id);
  }
}

export const drivesRepository = new DrivesRepository();
