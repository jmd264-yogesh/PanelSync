import { graph } from '@server/lib/graph';

export class UsersRepository {
  async searchUsers(query: string, token: string) {
    return graph.searchUsers(query, token);
  }
}

export const usersRepository = new UsersRepository();
