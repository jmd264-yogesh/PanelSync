import { NextRequest, NextResponse } from 'next/server';
import { getAnyValidAccessToken } from '@/lib/session';
import { db, dbClient } from '@/lib/db';
import { graph } from '@/lib/graph';
import * as schema from '@/lib/schema';
import { eq, and, gte, lt, sql, isNull } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, startTime, endTime } = body;
    let slots = body.slots;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    if (!slots && startTime && endTime) {
      slots = [{ startTime, endTime }];
    }

    if (!slots || !slots.length) {
      return NextResponse.json({ error: 'Missing required booking details' }, { status: 400 });
    }

    // 1. Look up panel and interview by token
    const result = await db.getInterviewByPanelToken(token);
    if (!result) {
      return NextResponse.json({ error: 'Interview request not found or expired' }, { status: 404 });
    }

    const { interview, panel } = result;

    if (interview.status === 'SCHEDULED') {
      return NextResponse.json({ error: 'Interview is already scheduled' }, { status: 400 });
    }

    // 2. Fetch active recruiter access token
    const tokenInfo = await getAnyValidAccessToken();
    if (!tokenInfo) {
      return NextResponse.json({ error: 'Recruiter session is expired or not logged in' }, { status: 401 });
    }

    const bookedMeetings = [];

    // Fetch waiting candidates once to prevent duplicate assignment in memory
    const waitingCandidates = await dbClient
      .select()
      .from(schema.uploadedCandidates)
      .where(and(eq(schema.uploadedCandidates.status, 'WAITING'), isNull(schema.uploadedCandidates.deletedAt)))
      .orderBy(schema.uploadedCandidates.createdAt);

    let collegeNameFromRole = '';
    const parts = interview.role.split(' - ');
    if (parts.length > 1) {
      collegeNameFromRole = parts[1].trim().toLowerCase();
    }

    for (let i = 0; i < slots.length; i++) {
      const { startTime: slotStart, endTime: slotEnd } = slots[i];
      const slotDate = new Date(slotStart);
      const startOfDay = new Date(Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate()));
      const startOfNextDay = new Date(Date.UTC(slotDate.getUTCFullYear(), slotDate.getUTCMonth(), slotDate.getUTCDate() + 1));

      // Find a matching candidate
      let matchedCandidate = null;
      if (interview.candidateName === 'Pending Assignment') {
        const candidateIndex = waitingCandidates.findIndex(c => {
          const matchesCollege = collegeNameFromRole ? c.collegeDrive?.toLowerCase() === collegeNameFromRole : true;
          const cDate = c.preferredDate ? new Date(c.preferredDate) : null;
          if (!cDate) return false;
          
          const matchesDate = cDate.getTime() >= startOfDay.getTime() && cDate.getTime() < startOfNextDay.getTime();
          return matchesCollege && matchesDate;
        });

        if (candidateIndex !== -1) {
          matchedCandidate = waitingCandidates[candidateIndex];
          // Remove from list so it won't be mapped again in subsequent iterations
          waitingCandidates.splice(candidateIndex, 1);
        }
      }

      let finalCandidateName = matchedCandidate ? matchedCandidate.name : interview.candidateName;
      let finalCandidateEmail = matchedCandidate ? matchedCandidate.email : interview.candidateEmail;

      // 1. Create Teams meeting
      const description = matchedCandidate
        ? `Interview scheduled by panelist ${panel.name} selecting slot option. Candidate automatically mapped from bulk upload queue.`
        : `Interview scheduled by panelist ${panel.name} selecting slot option.`;

      const ccEmails = await db.getRecruiterCCEmails(tokenInfo.email);

      const meeting = await graph.createTeamsMeeting(
        tokenInfo.email,
        {
          candidateName: finalCandidateName,
          candidateEmail: finalCandidateEmail,
          role: interview.role,
          description,
          startTime: slotStart,
          endTime: slotEnd,
          panelEmails: [panel.email],
          ccEmails,
        },
        tokenInfo.token
      );

      const teamsMeetingUrl = meeting.joinUrl || meeting.webLink || '';
      const calendarEventId = meeting.id || '';

      if (i === 0) {
        // First slot: update original interview
        if (matchedCandidate) {
          await dbClient
            .update(schema.uploadedCandidates)
            .set({ status: 'MAPPED', mappedInterviewId: interview.id })
            .where(eq(schema.uploadedCandidates.id, matchedCandidate.id));

          await dbClient
            .update(schema.interviews)
            .set({
              candidateName: finalCandidateName,
              candidateEmail: finalCandidateEmail,
              updatedAt: new Date(),
            })
            .where(eq(schema.interviews.id, interview.id));
        }

        await db.bookInterview(interview.id, {
          scheduledSlotStart: slotStart,
          scheduledSlotEnd: slotEnd,
          teamsMeetingUrl,
          calendarEventId,
        });

        const now = new Date();
        await dbClient
          .update(schema.interviewPanels)
          .set({ status: 'SUBMITTED', submittedAt: now })
          .where(eq(schema.interviewPanels.id, panel.id));

        // Wipe proposed availabilities and save only the selected slot
        await dbClient
          .delete(schema.panelAvailabilities)
          .where(eq(schema.panelAvailabilities.panelId, panel.id));

        await dbClient.insert(schema.panelAvailabilities).values({
          id: crypto.randomUUID(),
          panelId: panel.id,
          startTime: new Date(slotStart),
          endTime: new Date(slotEnd),
        });

        bookedMeetings.push({
          startTime: slotStart,
          endTime: slotEnd,
          joinUrl: teamsMeetingUrl,
          candidateName: finalCandidateName,
        });
      } else {
        // Subsequent slots: create new interview and panelist record
        const newInterviewId = crypto.randomUUID();
        const now = new Date();

        const newStatus = matchedCandidate ? 'SCHEDULED' : (interview.candidateName === 'Pending Assignment' ? 'COLLECTED' : 'SCHEDULED');

        // Insert new interview
        await dbClient.insert(schema.interviews).values({
          id: newInterviewId,
          candidateName: finalCandidateName,
          candidateEmail: finalCandidateEmail,
          role: interview.role,
          duration: interview.duration,
          startDate: new Date(interview.startDate),
          endDate: new Date(interview.endDate),
          status: newStatus,
          teamsMeetingUrl,
          calendarEventId,
          scheduledSlotStart: new Date(slotStart),
          scheduledSlotEnd: new Date(slotEnd),
          createdAt: now,
          updatedAt: now,
        });

        if (matchedCandidate) {
          await dbClient
            .update(schema.uploadedCandidates)
            .set({ status: 'MAPPED', mappedInterviewId: newInterviewId })
            .where(eq(schema.uploadedCandidates.id, matchedCandidate.id));
        }

        // Insert new panel row
        const newPanelId = crypto.randomUUID();
        const newToken = crypto.randomUUID().replace(/-/g, '');
        await dbClient.insert(schema.interviewPanels).values({
          id: newPanelId,
          interviewId: newInterviewId,
          userId: panel.userId,
          name: panel.name,
          email: panel.email,
          token: newToken,
          status: 'SUBMITTED',
          submittedAt: now,
        });

        // Insert the booked slot for the subsequent panelist record
        await dbClient.insert(schema.panelAvailabilities).values({
          id: crypto.randomUUID(),
          panelId: newPanelId,
          startTime: new Date(slotStart),
          endTime: new Date(slotEnd),
        });

        bookedMeetings.push({
          startTime: slotStart,
          endTime: slotEnd,
          joinUrl: teamsMeetingUrl,
          candidateName: finalCandidateName,
        });
      }
    }

    return NextResponse.json({ success: true, meetings: bookedMeetings });
  } catch (error) {
    console.error('Failed to select slot and schedule meeting:', error);
    return NextResponse.json({ error: 'Failed to schedule meeting' }, { status: 500 });
  }
}
