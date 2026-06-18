import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@/lib/session';
import { db, dbClient } from '@/lib/db';
import { graph } from '@/lib/graph';
import * as schema from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { interviewId, candidateName, candidateEmail, sendAsTeamsMeeting } = body;

    if (!interviewId || !candidateName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const finalEmail = candidateEmail || 'pending@assign.com';

    // 1. Fetch existing interview
    const interview = await db.getInterview(interviewId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // 2. Update database record
    const hasBookedSlot = interview.scheduledSlotStart ? true : false;
    const nextStatus = hasBookedSlot ? 'SCHEDULED' : 'COLLECTED';

    await dbClient
      .update(schema.interviews)
      .set({
        candidateName,
        candidateEmail: finalEmail,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(schema.interviews.id, interviewId));

    // Also update candidate status in bulk upload queue to MAPPED
    if (candidateEmail && candidateEmail !== 'pending@assign.com') {
      await dbClient
        .update(schema.uploadedCandidates)
        .set({
          status: 'MAPPED',
          mappedInterviewId: interviewId,
        })
        .where(
          sql`LOWER(${schema.uploadedCandidates.email}) = LOWER(${candidateEmail.trim()})`
        );
    }

    // 3. If the interview is already scheduled, update the Microsoft Calendar event via Graph API PATCH
    if (interview.calendarEventId) {
      try {
        const panelEmails = interview.panels.map((p) => p.email);
        const description = 'Interview scheduled via Microsoft Teams Scheduler. Candidate assigned.';
        const ccEmails = await db.getRecruiterCCEmails(session.user.email);
        
        await graph.updateTeamsMeeting(
          interview.calendarEventId,
          {
            candidateName,
            candidateEmail,
            role: interview.role,
            description,
            panelEmails,
            sendAsTeamsMeeting: sendAsTeamsMeeting !== false, // default to true if not specified
            teamsMeetingUrl: interview.teamsMeetingUrl || undefined,
            ccEmails,
          },
          token
        );
      } catch (graphError: any) {
        console.error('Failed to update MS Graph calendar event with candidate:', graphError);
        
        const errMsg = graphError instanceof Error ? graphError.message : String(graphError);
        if (errMsg.includes('404') || errMsg.includes('ErrorItemNotFound')) {
          console.log('Calendar event not found in Outlook store. Re-creating calendar event on the fly...');
          try {
            if (interview.scheduledSlotStart && interview.scheduledSlotEnd) {
              const panelEmails = interview.panels.map((p) => p.email);
              const description = 'Interview scheduled via Microsoft Teams Scheduler. Re-created after original event was not found.';
              const ccEmails = await db.getRecruiterCCEmails(session.user.email);
              
              const meeting = await graph.createTeamsMeeting(
                session.user.email,
                {
                  candidateName,
                  candidateEmail: finalEmail,
                  role: interview.role,
                  description,
                  startTime: interview.scheduledSlotStart,
                  endTime: interview.scheduledSlotEnd,
                  panelEmails,
                  ccEmails,
                },
                token
              );
              
              // Update database record with new calendar details
              await dbClient
                .update(schema.interviews)
                .set({
                  teamsMeetingUrl: meeting.joinUrl || meeting.webLink || '',
                  calendarEventId: meeting.id || '',
                  updatedAt: new Date(),
                })
                .where(eq(schema.interviews.id, interviewId));
                
              console.log('Successfully re-created calendar event:', meeting.id);
            }
          } catch (recreateError) {
            console.error('Failed to re-create calendar event:', recreateError);
          }
        }
      }
    }

    const updatedInterview = await db.getInterview(interviewId);

    // Send Teams message notification to the panelists if scheduled
    if (updatedInterview && updatedInterview.scheduledSlotStart) {
      const finalJoinUrl = updatedInterview.teamsMeetingUrl || '';
      const timingString = new Date(updatedInterview.scheduledSlotStart).toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });

      for (const panel of updatedInterview.panels) {
        try {
          // Create 1:1 chat between recruiter (sender) and panelist
          const chat = await graph.createOneOnOneChat(session.user.id, panel.userId, token);
          
          const htmlMessage = `
            <div style="font-family: 'Segoe UI', system-ui, sans-serif; padding: 16px; border-left: 4px solid #10b981; background-color: #0f172a; color: #f8fafc; border-radius: 8px; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
              <h3 style="margin-top: 0; color: #10b981; font-size: 16px; font-weight: 600;">Candidate Assigned to Interview</h3>
              <p style="margin: 8px 0; font-size: 14px; color: #cbd5e1;">Hello <strong>${panel.name}</strong>,</p>
              <p style="margin: 8px 0; font-size: 14px; color: #94a3b8;">
                A candidate has been assigned to your scheduled interview round.
              </p>
              <div style="background-color: rgba(255,255,255,0.05); padding: 10px; border-radius: 6px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 13px; color: #94a3b8; margin-bottom: 2px;">Candidate Name</div>
                <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${candidateName}</div>
                <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Role / Round</div>
                <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${updatedInterview.role}</div>
                <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; margin-bottom: 2px;">Scheduled Timing</div>
                <div style="font-size: 14px; font-weight: bold; color: #ffffff;">${timingString}</div>
              </div>
              ${finalJoinUrl ? `
              <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">
                You can join the Teams meeting using the button below:
              </p>
              <div style="margin-top: 16px; margin-bottom: 12px;">
                <a href="${finalJoinUrl}" style="background-color: #10b981; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">
                  Join Teams Meeting
                </a>
              </div>
              ` : ''}
            </div>
          `;
          
          await graph.sendTeamsMessage(chat.id, htmlMessage, token);
        } catch (chatError) {
          console.error(`Failed to notify panelist ${panel.email} via Teams:`, chatError);
        }
      }
    }

    return NextResponse.json({ success: true, interview: updatedInterview });
  } catch (error) {
    console.error('Failed to assign candidate:', error);
    return NextResponse.json({ error: 'Failed to assign candidate' }, { status: 500 });
  }
}
