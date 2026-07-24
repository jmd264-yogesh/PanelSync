import { db } from '@server/lib/db';

export class PanelistsRepository {
  async getAll() {
    return db.getPanelists();
  }

  async add(user: any, roles: ('L1' | 'L2')[]) {
    return db.addPanelist(user, roles);
  }

  async remove(id: string) {
    return db.removePanelist(id);
  }
}

export const panelistsRepository = new PanelistsRepository();
