import { NextRequest, NextResponse } from 'next/server';
import { getAnyValidAccessToken } from '@/lib/session';
import { db, dbClient } from '@/lib/db';
import { graph } from '@/lib/graph';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, startTime, endTime } = body;

    if (!token || !startTime || !endTime) {
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

    // Check and auto-assign candidate if pending
    let finalCandidateName = interview.candidateName;
    let finalCandidateEmail = interview.candidateEmail;
    let mappedCandidate = null;

    if (interview.candidateName === 'Pending Assignment') {
      const [waitingCandidate] = await dbClient
        .select()
        .from(schema.uploadedCandidates)
        .where(eq(schema.uploadedCandidates.status, 'WAITING'))
        .orderBy(schema.uploadedCandidates.createdAt)
        .limit(1);

      if (waitingCandidate) {
        finalCandidateName = waitingCandidate.name;
        finalCandidateEmail = waitingCandidate.email;
        mappedCandidate = waitingCandidate;

        // Update candidate in DB
        await dbClient
          .update(schema.uploadedCandidates)
          .set({ status: 'MAPPED', mappedInterviewId: interview.id })
          .where(eq(schema.uploadedCandidates.id, waitingCandidate.id));

        // Update interview details in DB
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

    // 3. Create Microsoft Teams calendar event
    const description = mappedCandidate
      ? `Interview scheduled by panelist ${panel.name} selecting slot option. Candidate automatically mapped from bulk upload queue.`
      : `Interview scheduled by panelist ${panel.name} selecting slot option.`;

    const meeting = await graph.createTeamsMeeting(
      tokenInfo.email,
      {
        candidateName: finalCandidateName,
        candidateEmail: finalCandidateEmail,
        role: interview.role,
        description,
        startTime,
        endTime,
        panelEmails: [panel.email],
      },
      tokenInfo.token
    );

    // 4. Update the interview booking in Neon DB
    await db.bookInterview(interview.id, {
      scheduledSlotStart: startTime,
      scheduledSlotEnd: endTime,
      teamsMeetingUrl: meeting.joinUrl || meeting.webLink || '',
      calendarEventId: meeting.id || '',
    });

    // 5. Update panel status to SUBMITTED
    const now = new Date();
    await dbClient
      .update(schema.interviewPanels)
      .set({ status: 'SUBMITTED', submittedAt: now })
      .where(eq(schema.interviewPanels.id, panel.id));

    return NextResponse.json({ success: true, meeting });
  } catch (error) {
    console.error('Failed to select slot and schedule meeting:', error);
    return NextResponse.json({ error: 'Failed to schedule meeting' }, { status: 500 });
  }
}
