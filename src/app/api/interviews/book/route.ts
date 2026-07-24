import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@server/lib/session';
import { interviewsService } from '@server/services/interviews/interviews.service';

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { interviewId, startTime, endTime, description } = body;

    // Validate required fields
    if (!interviewId || !startTime || !endTime) {
      return NextResponse.json({ error: 'Missing required booking details' }, { status: 400 });
    }

    // Book interview via service
    const result = await interviewsService.bookInterview(
      { interviewId, startTime, endTime, description },
      session.user.email,
      token
    );

    return NextResponse.json({ success: true, meeting: result.meeting });
  } catch (error: any) {
    console.error('Failed to book interview:', error);

    if (error.message === 'INTERVIEW_NOT_FOUND') {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to book interview' }, { status: 500 });
  }
}
