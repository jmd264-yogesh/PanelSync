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
    const { interviewId } = body;

    if (!interviewId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch existing interview
    const interview = await db.getInterview(interviewId);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    // 2. If there is a scheduled calendar event, delete it from Microsoft Graph
    if (interview.calendarEventId) {
      try {
        await graph.deleteCalendarEvent(interview.calendarEventId, token);
      } catch (graphError) {
        console.error('Failed to delete calendar event in MS Graph:', graphError);
        // We can still proceed with local cancellation even if Graph delete fails
      }
    }

    // 3. Update database record to cancel booking
    await db.cancelBooking(interviewId);

    const updatedInterview = await db.getInterview(interviewId);
    return NextResponse.json({ success: true, interview: updatedInterview });
  } catch (error) {
    console.error('Failed to cancel booking:', error);
    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
