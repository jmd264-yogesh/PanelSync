import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@/lib/session';
import { db } from '@/lib/db';
import { graph } from '@/lib/graph';

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { interviewId, startTime, endTime, description } = body;

    if (!interviewId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required booking details' }, { status: 400 });
    }

    const interview = await db.getInterview(interviewId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    const ccEmails = await db.getRecruiterCCEmails(session.user.email);

    // Call Microsoft Graph to create a calendar event with an online Teams meeting link
    const meeting = await graph.createTeamsMeeting(
      session.user.email,
      {
        candidateName: interview.candidateName,
        candidateEmail: interview.candidateEmail,
        role: interview.role,
        description: description || 'Interview scheduled via Microsoft Teams Scheduler.',
        startTime,
        endTime,
        panelEmails: interview.panels.map((p) => p.email),
        ccEmails,
      },
      token
    );

    // Save scheduled details to the JSON database
    await db.bookInterview(interviewId, {
      scheduledSlotStart: startTime,
      scheduledSlotEnd: endTime,
      teamsMeetingUrl: meeting.joinUrl || meeting.webLink || '',
      calendarEventId: meeting.id || '',
    });

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    console.error('Failed to book interview:', error);
    return NextResponse.json({ error: 'Failed to book interview' }, { status: 500 });
  }
}
