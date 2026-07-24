import { panelistsRepository } from '@server/repositories/panelists/panelists.repository';

interface PanelistUser {
  id: string;
  displayName: string;
  email: string;
}

export class PanelistsService {
  private repository = panelistsRepository;

  async getPanelists() {
    return this.repository.getAll();
  }

  async addPanelist(user: PanelistUser, roles: ('L1' | 'L2')[]) {
    // Validate user object
    if (!user || !user.id || !user.displayName || !user.email) {
      throw new Error('Missing user profile');
    }

    // Validate roles array
    if (!roles || !Array.isArray(roles)) {
      throw new Error('Missing or invalid roles');
    }

    return this.repository.add(user, roles);
  }

  async removePanelist(id: string) {
    if (!id) {
      throw new Error('ID is required');
    }

    const success = await this.repository.remove(id);
    if (!success) {
      throw new Error('Panelist not found');
    }

    return { success: true };
  }
}

export const panelistsService = new PanelistsService();
