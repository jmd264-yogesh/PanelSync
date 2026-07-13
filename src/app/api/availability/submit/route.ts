import { NextRequest, NextResponse } from 'next/server';
import { db, dbClient } from '@/lib/db';
import { getAnyValidAccessToken } from '@/lib/session';
import { graph } from '@/lib/graph';
import * as schema from '@/lib/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, slots } = body;

    if (!token || !slots || !Array.isArray(slots) || slots.length !== 1) {
      return NextResponse.json({ error: 'Missing token or invalid slots. Exactly one slot must be provided.' }, { status: 400 });
    }

    const now = Date.now();
    const hasPastSlot = slots.some((s: any) => new Date(s.startTime).getTime() < now);
    if (hasPastSlot) {
      return NextResponse.json({ error: 'Cannot submit availability slots in the past.' }, { status: 400 });
    }

    // Save availability in DB (this marks the panel status as SUBMITTED and interview as COLLECTED)
    const success = await db.submitAvailability(token, slots);
    if (!success) {
      return NextResponse.json({ error: 'Invalid token or panel not found' }, { status: 404 });
    }

    // Auto-booking logic
    const result = await db.getInterviewByPanelToken(token);
    if (!result) {
      return NextResponse.json({ success: true, warning: 'Interview not found after saving.' });
    }

    const { interview, panel } = result;
    if (interview.status === 'SCHEDULED') {
      return NextResponse.json({ success: true, warning: 'Already scheduled.' });
    }

    const tokenInfo = await getAnyValidAccessToken();
    if (!tokenInfo) {
      return NextResponse.json({ success: true, warning: 'No active recruiter session to auto-book.' });
    }

    const slotStart = slots[0].startTime;
    const slotEnd = slots[0].endTime;

    // Handle auto-mapping candidate if needed
    let finalCandidateName = interview.candidateName;
    let finalCandidateEmail = interview.candidateEmail;
    
    // Auto-map candidate from wait queue if this is a pending assignment
    if (interview.candidateName === 'Pending Assignment') {
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
            const candidate = waitingCandidates[candidateIndex];
            const claimed = await dbClient
                .update(schema.uploadedCandidates)
                .set({ status: 'MAPPED', mappedInterviewId: interview.id })
                .where(and(eq(schema.uploadedCandidates.id, candidate.id), eq(schema.uploadedCandidates.status, 'WAITING')))
                .returning({ id: schema.uploadedCandidates.id });
                
            if (claimed.length > 0) {
                finalCandidateName = candidate.name;
                finalCandidateEmail = candidate.email;
                
                await dbClient
                    .update(schema.interviews)
                    .set({
                        candidateName: finalCandidateName,
                        candidateEmail: finalCandidateEmail,
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.interviews.id, interview.id));
            }
        }
    }

    const description = `Interview scheduled by panelist ${panel.name} via free-time slot submission.`;
    //email sent to cc recipients
    // const ccEmails = await db.getRecruiterCCEmails(tokenInfo.email);

    let meetingJoinUrl = '';
    
    try {
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
                // ccEmails,
            },
            tokenInfo.token
        );
        
        meetingJoinUrl = meeting.joinUrl || meeting.webLink || '';
        
        await db.bookInterview(interview.id, {
            scheduledSlotStart: slotStart,
            scheduledSlotEnd: slotEnd,
            teamsMeetingUrl: meetingJoinUrl,
            calendarEventId: meeting.id || '',
        });

        // Optional: Notify panelist via Teams
        if (finalCandidateName && finalCandidateName !== 'Pending Assignment') {
            const timingString = new Date(slotStart).toLocaleString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
            });
            const chat = await graph.createOneOnOneChat(tokenInfo.userId, panel.userId, tokenInfo.token);
            const htmlMessage = `
              <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #10b981; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                <h3 style="margin-top: 0; color: #10b981; font-size: 16px; font-weight: 600;">Candidate Assigned to Interview</h3>
                <p style="margin: 8px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${panel.name}</strong>,</p>
                <p style="margin: 8px 0; font-size: 14px; color: #94a3b8;">A candidate has been assigned to your scheduled interview round.</p>
                <div style="background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Candidate Name</div>
                  <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${finalCandidateName}</div>
                  <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Role / Round</div>
                  <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${interview.role}</div>
                  <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Scheduled Timing</div>
                  <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${timingString}</div>
                </div>
                ${meetingJoinUrl ? `<div style="margin-top: 16px; margin-bottom: 12px;"><a href="${meetingJoinUrl}" style="background-color: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Join Teams Meeting</a></div>` : ''}
              </div>
            `;
            await graph.sendTeamsMessage(chat.id, htmlMessage, tokenInfo.token);
        }
    } catch (e) {
        console.error("Failed to auto-schedule Teams meeting:", e);
        return NextResponse.json({ success: true, warning: 'Failed to create Teams meeting' });
    }

    return NextResponse.json({ success: true, booking: { startTime: slotStart, endTime: slotEnd, teamsMeetingUrl: meetingJoinUrl } });
  } catch (error) {
    console.error('Failed to submit availability:', error);
    return NextResponse.json({ error: 'Failed to submit availability' }, { status: 500 });
  }
}
