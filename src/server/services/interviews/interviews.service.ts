import { interviewsRepository } from '@server/repositories/interviews/interviews.repository';
import { graph } from '@server/lib/graph';
import { dbClient } from '@server/lib/db';
import * as schema from '@server/lib/schema';
import { sql } from 'drizzle-orm';

export type TCreateInterviewParams = {
  candidateName: string;
  candidateEmail: string;
  role: string;
  hiringType?: string;
  duration: number;
  startDate: string;
  endDate: string;
  panels: Array<{
    id: string;
    displayName: string;
    mail?: string;
    userPrincipalName?: string;
  }>;
  lateralCandidateId?: string;
};

export type TBookingParams = {
  interviewId: string;
  startTime: string;
  endTime: string;
  description?: string;
};

export type TTeamsMeetingDetails = {
  candidateName: string;
  candidateEmail: string;
  role: string;
  description: string;
  startTime: string;
  endTime: string;
  panelEmails: string[];
  ccEmails: string[];
};

/**
 * Interviews Service - Business logic for interview operations
 * Handles interview lifecycle, booking, Teams integration, and notifications
 */
export const interviewsService = {
  /**
   * Get all interviews
   */
  async getAllInterviews() {
    return await interviewsRepository.getAll();
  },

  /**
   * Get interview by ID
   */
  async getInterviewById(id: string) {
    const interview = await interviewsRepository.getById(id);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }
    return interview;
  },

  /**
   * Get interview by panel token
   */
  async getInterviewByPanelToken(token: string) {
    const interview = await interviewsRepository.getByPanelToken(token);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }
    return interview;
  },

  /**
   * Create a new interview with panels
   */
  async createInterview(params: TCreateInterviewParams, userEmail: string) {
    // Transform panels to repository format
    const panels = params.panels.map((p) => ({
      userId: p.id,
      name: p.displayName,
      email: p.mail || p.userPrincipalName || '',
    }));

    // Create interview in database
    const interview = await interviewsRepository.create({
      candidateName: params.candidateName,
      candidateEmail: params.candidateEmail,
      role: params.role,
      hiringType: params.hiringType,
      duration: params.duration,
      startDate: params.startDate,
      endDate: params.endDate,
      panels,
      lateralCandidateId: params.lateralCandidateId,
    });

    // Update uploaded candidate status to MAPPED if applicable
    if (params.candidateEmail && params.candidateEmail !== 'pending@assign.com') {
      try {
        await dbClient
          .update(schema.uploadedCandidates)
          .set({
            status: 'MAPPED',
            mappedInterviewId: interview.id,
          })
          .where(
            sql`LOWER(${schema.uploadedCandidates.email}) = LOWER(${params.candidateEmail.trim()})`
          );
      } catch (dbErr) {
        console.error('Failed to update uploaded candidate status to MAPPED:', dbErr);
      }
    }

    // Link to lateral candidate and update status if applicable
    if (params.lateralCandidateId) {
      try {
        await dbClient
          .update(schema.lateralCandidates)
          .set({
            mappedInterviewId: interview.id,
            status: 'INTERVIEW_SCHEDULED',
          })
          .where(sql`${schema.lateralCandidates.id} = ${params.lateralCandidateId}`);
      } catch (dbErr) {
        console.error('Failed to link lateral candidate to interview:', dbErr);
      }
    }

    return interview;
  },

  /**
   * Update interview details
   */
  async updateInterview(id: string, data: any) {
    const interview = await interviewsRepository.getById(id);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }

    return await interviewsRepository.update(id, data);
  },

  /**
   * Delete an interview
   */
  async deleteInterview(id: string) {
    const interview = await interviewsRepository.getById(id);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }

    return await interviewsRepository.delete(id);
  },

  /**
   * Book an interview with Teams meeting
   */
  async bookInterview(params: TBookingParams, userEmail: string, accessToken: string) {
    const interview = await interviewsRepository.getById(params.interviewId);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }

    // Get CC emails for the recruiter
    const ccEmails = await interviewsRepository.getRecruiterCCEmails(userEmail);

    // Create Teams meeting
    const meetingDetails: TTeamsMeetingDetails = {
      candidateName: interview.candidateName,
      candidateEmail: interview.candidateEmail,
      role: interview.role,
      description: params.description || 'Interview scheduled via Microsoft Teams Scheduler.',
      startTime: params.startTime,
      endTime: params.endTime,
      panelEmails: interview.panels.map((p: any) => p.email),
      ccEmails,
    };

    const meeting = await graph.createTeamsMeeting(
      userEmail,
      meetingDetails,
      accessToken
    );

    // Save booking details to database
    await interviewsRepository.book(params.interviewId, {
      scheduledSlotStart: params.startTime,
      scheduledSlotEnd: params.endTime,
      teamsMeetingUrl: meeting.joinUrl || meeting.webLink || '',
      calendarEventId: meeting.id || '',
    });

    return { interview, meeting };
  },

  /**
   * Cancel an interview booking
   */
  async cancelBooking(interviewId: string, accessToken: string) {
    const interview = await interviewsRepository.getById(interviewId);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }

    if (!interview.calendarEventId) {
      throw new Error('NO_BOOKING_TO_CANCEL');
    }

    // Delete calendar event from Microsoft Graph
    try {
      await graph.deleteCalendarEvent(interview.calendarEventId, accessToken);
    } catch (graphErr) {
      console.error('Failed to delete calendar event:', graphErr);
      // Continue with database update even if Graph call fails
    }

    // Update database to remove booking details
    await interviewsRepository.cancelBooking(interviewId);

    return { success: true };
  },

  /**
   * Submit panel availability slots
   */
  async submitAvailability(token: string, slots: Array<{ startTime: string; endTime: string }>) {
    // Validate slots are not in the past
    const now = Date.now();
    for (const slot of slots) {
      if (new Date(slot.startTime).getTime() < now) {
        throw new Error('SLOT_IN_PAST');
      }
    }

    return await interviewsRepository.submitAvailability(token, slots);
  },

  /**
   * Send availability invite to a panel member
   */
  async sendAvailabilityInvite(
    panelEmail: string,
    availabilityLink: string,
    interviewDetails: {
      candidateName: string;
      role: string;
      duration: number;
      startDate: string;
      endDate: string;
    },
    accessToken: string
  ) {
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0078d4;">Panel Availability Request</h2>
        <p>You have been requested to provide your availability for an interview:</p>
        <ul>
          <li><strong>Candidate:</strong> ${interviewDetails.candidateName}</li>
          <li><strong>Role:</strong> ${interviewDetails.role}</li>
          <li><strong>Duration:</strong> ${interviewDetails.duration} minutes</li>
          <li><strong>Date Range:</strong> ${interviewDetails.startDate} to ${interviewDetails.endDate}</li>
        </ul>
        <p>Please click the link below to submit your availability:</p>
        <a href="${availabilityLink}" style="display: inline-block; padding: 10px 20px; background-color: #0078d4; color: white; text-decoration: none; border-radius: 5px;">
          Submit Availability
        </a>
      </div>
    `;

    await graph.sendTeamsMessage(panelEmail, htmlContent, accessToken);
  },

  /**
   * Resend availability invite to a panel member
   */
  async resendInvite(interviewId: string, panelId: string, accessToken: string) {
    const interview = await interviewsRepository.getById(interviewId);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }

    const panel = interview.panels.find((p: any) => p.id === panelId);
    if (!panel) {
      throw new Error('PANEL_NOT_FOUND');
    }

    const availabilityLink = `${process.env.NEXT_PUBLIC_APP_URL}/availability/${panel.token}`;

    await this.sendAvailabilityInvite(
      panel.email,
      availabilityLink,
      {
        candidateName: interview.candidateName,
        role: interview.role,
        duration: interview.duration,
        startDate: interview.startDate,
        endDate: interview.endDate,
      },
      accessToken
    );

    return { success: true };
  },

  /**
   * Assign a candidate to a pending interview
   */
  async assignCandidate(
    interviewId: string,
    candidateName: string,
    candidateEmail: string,
    userEmail: string,
    accessToken: string
  ) {
    const interview = await interviewsRepository.getById(interviewId);
    if (!interview) {
      throw new Error('INTERVIEW_NOT_FOUND');
    }

    if (interview.candidateName !== 'Pending Assignment') {
      throw new Error('INTERVIEW_ALREADY_ASSIGNED');
    }

    // Update interview with candidate details
    await interviewsRepository.update(interviewId, {
      candidateName,
      candidateEmail,
      status: 'SCHEDULED', // Interviews ready for assignment are already COLLECTED/booked
    });

    // If interview has a calendar event, update it with candidate details
    if (interview.calendarEventId) {
      try {
        const ccEmails = await interviewsRepository.getRecruiterCCEmails(userEmail);
        const panelEmails = interview.panels.map((p: any) => p.email);
        const description = 'Interview scheduled via Microsoft Teams Scheduler. Candidate assigned.';

        // Note: graph.updateCalendarEvent doesn't exist yet
        // For now, skip calendar update - can be added later
        console.log('Calendar update skipped - method not implemented');
      } catch (graphErr) {
        console.error('Failed to update calendar event with candidate details:', graphErr);
      }
    }

    // Update candidate in upload queue to MAPPED
    try {
      await dbClient
        .update(schema.uploadedCandidates)
        .set({
          status: 'MAPPED',
          mappedInterviewId: interviewId,
        })
        .where(
          sql`LOWER(${schema.uploadedCandidates.email}) = LOWER(${candidateEmail.trim()})`
        );
    } catch (dbErr) {
      console.error('Failed to update candidate status:', dbErr);
    }

    return { success: true };
  },

  /**
   * Check and send feedback reminders for ended interviews
   */
  async checkAndSendFeedbackReminders(accessToken: string) {
    const interviews = await interviewsRepository.getInterviewsNeedingEndedReminders();

    for (const interview of interviews) {
      for (const panel of interview.panels) {
        if (!panel.feedbackSubmittedAt) {
          try {
            const feedbackLink = `${process.env.NEXT_PUBLIC_APP_URL}/panelist`;
            const htmlContent = `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <h3>Feedback Reminder</h3>
                <p>Your interview with ${interview.candidateName} has ended. Please submit your feedback.</p>
                <a href="${feedbackLink}" style="display: inline-block; padding: 10px 20px; background-color: #0078d4; color: white; text-decoration: none; border-radius: 5px;">
                  Submit Feedback
                </a>
              </div>
            `;

            await graph.sendTeamsMessage(panel.email, htmlContent, accessToken);
          } catch (err) {
            console.error(`Failed to send reminder to ${panel.email}:`, err);
          }
        }
      }

      await interviewsRepository.markReminderSent(interview.id, 'FEEDBACK_REMINDER');
    }

    return { sentCount: interviews.length };
  },
};
