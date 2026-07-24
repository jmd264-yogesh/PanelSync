import { db } from '@server/lib/db';

/**
 * Auth Repository - Data access layer for authentication operations
 * Wraps database calls to provide auth-specific interface
 */
export const authRepository = {
  /**
   * Check if an email is allowed to access the recruiter dashboard
   */
  async isRecruiterAllowed(email: string): Promise<boolean> {
    return await db.isEmailAllowed(email);
  },

  /**
   * Check if an email belongs to a registered panelist
   */
  async isPanelistRegistered(email: string): Promise<boolean> {
    return await db.isPanelist(email);
  },
};
