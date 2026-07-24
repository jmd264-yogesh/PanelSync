import { availabilityRepository } from '@server/repositories/availability/availability.repository';
import { graph } from '@server/lib/graph';

interface TokenInfo {
  token: string;
  email: string;
  userId: string;
}

export class AvailabilityService {
  private repository = availabilityRepository;

  private validateSlotsNotInPast(slots: any[]): void {
    const now = Date.now();
    const hasPastSlot = slots.some((s: any) => new Date(s.startTime).getTime() < now);
    if (hasPastSlot) {
      throw new Error('Cannot submit availability slots in the past.');
    }
  }

  private async findMatchingCandidate(
    waitingCandidates: any[],
    collegeNameFromRole: string,
    slotStart: string
  ): Promise<{ candidate: any; index: number } | null> {
    const slotDate = new Date(slotStart);
    const startOfDay = new Date(Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate()));
    const startOfNextDay = new Date(Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate() + 1));

    const candidateIndex = waitingCandidates.findIndex(c => {
      const matchesCollege = collegeNameFromRole ? c.collegeDrive?.toLowerCase() === collegeNameFromRole : true;
      const cDate = c.preferredDate ? new Date(c.preferredDate) : null;
      if (!cDate) return false;
      const matchesDate = cDate.getTime() >= startOfDay.getTime() && cDate.getTime() < startOfNextDay.getTime();
      return matchesCollege && matchesDate;
    });

    if (candidateIndex !== -1) {
      return { candidate: waitingCandidates[candidateIndex], index: candidateIndex };
    }

    return null;
  }

  private async createTeamsMeetingAndNotify(
    tokenInfo: TokenInfo,
    candidateName: string,
    candidateEmail: string,
    role: string,
    description: string,
    slotStart: string,
    slotEnd: string,
    panelEmail: string,
    panelName: string,
    panelUserId: string,
    shouldNotify: boolean
  ): Promise<{ joinUrl: string; calendarEventId: string }> {
    const ccEmails = await this.repository.getRecruiterCCEmails(tokenInfo.email);

    const meeting = await graph.createTeamsMeeting(
      tokenInfo.email,
      {
        candidateName,
        candidateEmail,
        role,
        description,
        startTime: slotStart,
        endTime: slotEnd,
        panelEmails: [panelEmail],
        ccEmails,
      },
      tokenInfo.token
    );

    const joinUrl = meeting.joinUrl || meeting.webLink || '';
    const calendarEventId = meeting.id || '';

    // Send Teams notification if candidate is assigned
    if (shouldNotify && candidateName && candidateName !== 'Pending Assignment') {
      try {
        const timingString = new Date(slotStart).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        });

        const chat = await graph.createOneOnOneChat(tokenInfo.userId, panelUserId, tokenInfo.token);

        const htmlMessage = `
          <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #10b981; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <h3 style="margin-top: 0; color: #10b981; font-size: 16px; font-weight: 600;">Candidate Assigned to Interview</h3>
            <p style="margin: 8px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${panelName}</strong>,</p>
            <p style="margin: 8px 0; font-size: 14px; color: #94a3b8;">A candidate has been assigned to your scheduled interview round.</p>
            <div style="background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.05);">
              <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Candidate Name</div>
              <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${candidateName}</div>
              <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Role / Round</div>
              <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${role}</div>
              <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Scheduled Timing</div>
              <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${timingString}</div>
            </div>
            ${joinUrl ? `<div style="margin-top: 16px; margin-bottom: 12px;"><a href="${joinUrl}" style="background-color: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Join Teams Meeting</a></div>` : ''}
          </div>
        `;

        await graph.sendTeamsMessage(chat.id, htmlMessage, tokenInfo.token);
      } catch (chatError) {
        console.error(`Failed to send confirmation Teams message to panel ${panelEmail}:`, chatError);
      }
    }

    return { joinUrl, calendarEventId };
  }

  async submitAvailability(token: string, slots: any[], tokenInfo: TokenInfo | null) {
    if (!slots || !Array.isArray(slots) || slots.length !== 1) {
      throw new Error('Missing token or invalid slots. Exactly one slot must be provided.');
    }

    this.validateSlotsNotInPast(slots);

    const success = await this.repository.submitAvailability(token, slots);
    if (!success) {
      throw new Error('Invalid token or panel not found');
    }

    const result = await this.repository.getInterviewByPanelToken(token);
    if (!result) {
      return { success: true, warning: 'Interview not found after saving.' };
    }

    const { interview, panel } = result;
    if (interview.status === 'SCHEDULED') {
      return { success: true, warning: 'Already scheduled.' };
    }

    if (!tokenInfo) {
      return { success: true, warning: 'No active recruiter session to auto-book.' };
    }

    const slotStart = slots[0].startTime;
    const slotEnd = slots[0].endTime;

    let finalCandidateName = interview.candidateName;
    let finalCandidateEmail = interview.candidateEmail;

    // Auto-map candidate if needed
    if (interview.candidateName === 'Pending Assignment') {
      const waitingCandidates = await this.repository.getWaitingCandidates();
      let collegeNameFromRole = '';
      const parts = interview.role.split(' - ');
      if (parts.length > 1) {
        collegeNameFromRole = parts[1].trim().toLowerCase();
      }

      const match = await this.findMatchingCandidate(waitingCandidates, collegeNameFromRole, slotStart);
      if (match) {
        const claimed = await this.repository.claimCandidate(match.candidate.id, interview.id);
        if (claimed.length > 0) {
          finalCandidateName = match.candidate.name;
          finalCandidateEmail = match.candidate.email;
          await this.repository.updateInterviewCandidate(interview.id, finalCandidateName, finalCandidateEmail);
        }
      }
    }

    const description = `Interview scheduled by panelist ${panel.name} via free-time slot submission.`;

    try {
      const { joinUrl, calendarEventId } = await this.createTeamsMeetingAndNotify(
        tokenInfo,
        finalCandidateName,
        finalCandidateEmail,
        interview.role,
        description,
        slotStart,
        slotEnd,
        panel.email,
        panel.name,
        panel.userId,
        true
      );

      await this.repository.bookInterview(interview.id, {
        scheduledSlotStart: slotStart,
        scheduledSlotEnd: slotEnd,
        teamsMeetingUrl: joinUrl,
        calendarEventId,
      });

      return {
        success: true,
        booking: { startTime: slotStart, endTime: slotEnd, teamsMeetingUrl: joinUrl },
      };
    } catch (e) {
      console.error('Failed to auto-schedule Teams meeting:', e);
      return { success: true, warning: 'Failed to create Teams meeting' };
    }
  }

  async selectSlot(token: string, slots: any[], tokenInfo: TokenInfo) {
    if (!token) {
      throw new Error('Missing token');
    }

    if (!slots || !slots.length) {
      throw new Error('Missing required booking details');
    }

    this.validateSlotsNotInPast(slots);

    const result = await this.repository.getInterviewByPanelToken(token);
    if (!result) {
      throw new Error('Interview request not found or expired');
    }

    const { interview, panel } = result;

    if (interview.status === 'SCHEDULED') {
      throw new Error('Interview is already scheduled');
    }

    const bookedMeetings = [];
    const waitingCandidates = await this.repository.getWaitingCandidates();

    let collegeNameFromRole = '';
    const parts = interview.role.split(' - ');
    if (parts.length > 1) {
      collegeNameFromRole = parts[1].trim().toLowerCase();
    }

    for (let i = 0; i < slots.length; i++) {
      const { startTime: slotStart, endTime: slotEnd } = slots[i];
      const targetInterviewId = i === 0 ? interview.id : crypto.randomUUID();

      let matchedCandidate: any = null;
      if (interview.candidateName === 'Pending Assignment') {
        const match = await this.findMatchingCandidate(waitingCandidates, collegeNameFromRole, slotStart);
        if (match) {
          waitingCandidates.splice(match.index, 1);
          const claimed = await this.repository.claimCandidate(match.candidate.id, targetInterviewId);
          if (claimed.length > 0) {
            matchedCandidate = match.candidate;
          }
        }
      }

      const finalCandidateName = matchedCandidate ? matchedCandidate.name : interview.candidateName;
      const finalCandidateEmail = matchedCandidate ? matchedCandidate.email : interview.candidateEmail;

      const description = matchedCandidate
        ? `Interview scheduled by panelist ${panel.name} selecting slot option. Candidate automatically mapped from bulk upload queue.`
        : `Interview scheduled by panelist ${panel.name} selecting slot option.`;

      const { joinUrl, calendarEventId } = await this.createTeamsMeetingAndNotify(
        tokenInfo,
        finalCandidateName,
        finalCandidateEmail,
        interview.role,
        description,
        slotStart,
        slotEnd,
        panel.email,
        panel.name,
        panel.userId,
        i > 0 && matchedCandidate !== null
      );

      if (i === 0) {
        // First slot: update original interview
        if (matchedCandidate) {
          await this.repository.updateInterviewCandidate(interview.id, finalCandidateName, finalCandidateEmail);
        }

        await this.repository.bookInterview(interview.id, {
          scheduledSlotStart: slotStart,
          scheduledSlotEnd: slotEnd,
          teamsMeetingUrl: joinUrl,
          calendarEventId,
        });

        const now = new Date();
        await this.repository.updatePanelStatus(panel.id, 'SUBMITTED', now);
        await this.repository.clearPanelAvailabilities(panel.id);
        await this.repository.savePanelAvailability(panel.id, new Date(slotStart), new Date(slotEnd));

        bookedMeetings.push({
          startTime: slotStart,
          endTime: slotEnd,
          joinUrl,
          candidateName: finalCandidateName,
        });
      } else {
        // Subsequent slots: create new interview
        const now = new Date();
        const newStatus = matchedCandidate ? 'SCHEDULED' : (interview.candidateName === 'Pending Assignment' ? 'COLLECTED' : 'SCHEDULED');

        await this.repository.createInterview({
          id: targetInterviewId,
          candidateName: finalCandidateName,
          candidateEmail: finalCandidateEmail,
          role: interview.role,
          duration: interview.duration,
          startDate: new Date(interview.startDate),
          endDate: new Date(interview.endDate),
          status: newStatus,
          hiringType: interview.hiringType,
          teamsMeetingUrl: joinUrl,
          calendarEventId,
          scheduledSlotStart: new Date(slotStart),
          scheduledSlotEnd: new Date(slotEnd),
          createdAt: now,
          updatedAt: now,
        });

        const newPanelId = crypto.randomUUID();
        const newToken = crypto.randomUUID().replace(/-/g, '');
        await this.repository.createPanel({
          id: newPanelId,
          interviewId: targetInterviewId,
          userId: panel.userId,
          name: panel.name,
          email: panel.email,
          token: newToken,
          status: 'SUBMITTED',
          submittedAt: now,
        });

        await this.repository.savePanelAvailability(newPanelId, new Date(slotStart), new Date(slotEnd));

        bookedMeetings.push({
          startTime: slotStart,
          endTime: slotEnd,
          joinUrl,
          candidateName: finalCandidateName,
        });
      }
    }

    return { success: true, meetings: bookedMeetings };
  }

  async rejectRequest(token: string, reason: string) {
    if (!token || !reason || !reason.trim()) {
      throw new Error('Missing token or rejection reason');
    }

    const panelRow = await this.repository.getPanelByToken(token);
    if (!panelRow) {
      throw new Error('Interview panel request not found');
    }

    await this.repository.clearPanelAvailabilities(panelRow.id);
    const now = await this.repository.updatePanelRejection(panelRow.id, reason);
    await this.repository.touchInterviewUpdatedAt(panelRow.interviewId, now);

    return { success: true };
  }
}

export const availabilityService = new AvailabilityService();
