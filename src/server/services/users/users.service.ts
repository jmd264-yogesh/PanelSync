import { usersRepository } from '@server/repositories/users/users.repository';

export class UsersService {
  private repository = usersRepository;

  async searchUsers(query: string, token: string) {
    // Return empty array for queries less than 2 characters
    if (query.trim().length < 2) {
      return [];
    }

    return this.repository.searchUsers(query, token);
  }
}

export const usersService = new UsersService();
