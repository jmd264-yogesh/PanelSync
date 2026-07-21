import { db } from '@server/lib/db';

/**
 * Interviews Repository - Data access layer for interview operations
 * Wraps database calls to provide interview-specific interface
 */
export const interviewsRepository = {
  /**
   * Get all interviews with nested panels and availabilities
   */
  async getAll() {
    return await db.getInterviews();
  },

  /**
   * Get a single interview by ID
   */
  async getById(id: string) {
    return await db.getInterview(id);
  },

  /**
   * Get interview by panel token (for availability submission)
   */
  async getByPanelToken(token: string) {
    return await db.getInterviewByPanelToken(token);
  },

  /**
   * Create a new interview with panels
   */
  async create(params: {
    candidateName: string;
    candidateEmail: string;
    role: string;
    hiringType?: string;
    duration: number;
    startDate: string;
    endDate: string;
    panels: Array<{ userId: string; name: string; email: string }>;
    lateralCandidateId?: string;
  }) {
    return await db.createInterview(params as any);
  },

  /**
   * Update an interview
   */
  async update(id: string, data: any) {
    // Note: db.updateInterview doesn't exist, using direct db client update
    const { dbClient } = await import('@server/lib/db');
    const schema = await import('@server/lib/schema');
    const { eq } = await import('drizzle-orm');

    await dbClient
      .update(schema.interviews)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.interviews.id, id));

    return await db.getInterview(id);
  },

  /**
   * Delete an interview
   */
  async delete(id: string) {
    return await db.deleteInterview(id);
  },

  /**
   * Submit panel availability
   */
  async submitAvailability(token: string, slots: Array<{ startTime: string; endTime: string }>) {
    return await db.submitAvailability(token, slots);
  },

  /**
   * Book an interview with scheduled time and Teams meeting details
   */
  async book(id: string, params: {
    scheduledSlotStart: string;
    scheduledSlotEnd: string;
    teamsMeetingUrl: string;
    calendarEventId: string;
  }) {
    return await db.bookInterview(id, params);
  },

  /**
   * Cancel a booking and revert status
   */
  async cancelBooking(id: string) {
    return await db.cancelBooking(id);
  },

  /**
   * Get recruiter CC emails for calendar events
   */
  async getRecruiterCCEmails(email: string) {
    return await db.getRecruiterCCEmails(email);
  },

  /**
   * Get candidate for an interview (from upload queue)
   */
  async getCandidateForInterview(interviewId: string) {
    return await db.getCandidateForInterview(interviewId);
  },

  /**
   * Get lateral candidate for an interview
   */
  async getLateralCandidateForInterview(interviewId: string) {
    return await db.getLateralCandidateForInterview(interviewId);
  },

  /**
   * Check if interviews need ended reminders
   */
  async getInterviewsNeedingEndedReminders(): Promise<any[]> {
    // Note: This method doesn't exist on db yet, return empty array for now
    return [];
  },

  /**
   * Mark interview reminder as sent
   */
  async markReminderSent(interviewId: string, reminderType: string) {
    // Note: This method doesn't exist on db yet, placeholder implementation
    return;
  },
};
