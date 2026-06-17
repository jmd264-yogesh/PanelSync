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
    return NextResponse.json({ success: true, interview: updatedInterview });
  } catch (error) {
    console.error('Failed to assign candidate:', error);
    return NextResponse.json({ error: 'Failed to assign candidate' }, { status: 500 });
  }
}
