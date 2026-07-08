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

    const now = Date.now();
    const hasPastSlot = slots.some((s: any) => new Date(s.startTime).getTime() < now);
    if (hasPastSlot) {
      return NextResponse.json({ error: 'Cannot book slots in the past.' }, { status: 400 });
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
      const targetInterviewId = i === 0 ? interview.id : crypto.randomUUID();

      // Find and atomically claim a matching candidate
      let matchedCandidate: typeof waitingCandidates[number] | null = null;
      if (interview.candidateName === 'Pending Assignment') {
        const candidateIndex = waitingCandidates.findIndex(c => {
          const matchesCollege = collegeNameFromRole ? c.collegeDrive?.toLowerCase() === collegeNameFromRole : true;
          const cDate = c.preferredDate ? new Date(c.preferredDate) : null;
          if (!cDate) return false;

          const matchesDate = cDate.getTime() >= startOfDay.getTime() && cDate.getTime() < startOfNextDay.getTime();
          return matchesCollege && matchesDate;
        });

        if (candidateIndex !== -1) {
          const candidate = waitingCandidates[candidateIndex];
          // Remove from list so it won't be matched again in subsequent iterations
          waitingCandidates.splice(candidateIndex, 1);

          // Atomically claim it — no-op if another concurrent mapping (bulk upload,
          // another panelist self-booking, L2 requeue) already took this candidate
          // between our SELECT above and now.
          const claimed = await dbClient
            .update(schema.uploadedCandidates)
            .set({ status: 'MAPPED', mappedInterviewId: targetInterviewId })
            .where(and(eq(schema.uploadedCandidates.id, candidate.id), eq(schema.uploadedCandidates.status, 'WAITING')))
            .returning({ id: schema.uploadedCandidates.id });
          if (claimed.length > 0) {
            matchedCandidate = candidate;
          }
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
        const newInterviewId = targetInterviewId;
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

        // Notify panelist via Teams if a candidate is assigned
        const hasCandidate = finalCandidateName && finalCandidateName !== 'Pending Assignment';
        if (hasCandidate) {
          try {
            const timingString = new Date(slotStart).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
            });

            // Create 1:1 chat between recruiter and panelist
            const chat = await graph.createOneOnOneChat(tokenInfo.userId, panel.userId, tokenInfo.token);

            const htmlMessage = `
              <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #10b981; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <h3 style="margin-top: 0; color: #10b981; font-size: 16px; font-weight: 600;">Candidate Assigned to Interview</h3>
                <p style="margin: 8px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${panel.name}</strong>,</p>
                <p style="margin: 8px 0; font-size: 14px; color: #94a3b8;">
                  A candidate has been assigned to your scheduled interview round.
                </p>
                <div style="background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Candidate Name</div>
                  <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${finalCandidateName}</div>
                  <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Role / Round</div>
                  <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${interview.role}</div>
                  <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Scheduled Timing</div>
                  <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${timingString}</div>
                </div>
                ${teamsMeetingUrl ? `
                <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">
                  You can join the Teams meeting using the button below:
                </p>
                <div style="margin-top: 16px; margin-bottom: 12px;">
                  <a href="${teamsMeetingUrl}" style="background-color: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                    Join Teams Meeting
                  </a>
                </div>
                ` : ''}
              </div>
            `;

            await graph.sendTeamsMessage(chat.id, htmlMessage, tokenInfo.token);
          } catch (chatError) {
            console.error(`Failed to send confirmation Teams message to panel ${panel.email}:`, chatError);
          }
        }
      }
    }

    return NextResponse.json({ success: true, meetings: bookedMeetings });
  } catch (error) {
    console.error('Failed to select slot and schedule meeting:', error);
    return NextResponse.json({ error: 'Failed to schedule meeting' }, { status: 500 });
  }
}
