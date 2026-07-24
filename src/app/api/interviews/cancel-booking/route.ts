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
    const { interviewId } = body;

    if (!interviewId) {
      return NextResponse.json({ error: 'Missing interview ID' }, { status: 400 });
    }

    // Cancel booking via service
    await interviewsService.cancelBooking(interviewId, token);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to cancel booking:', error);

    if (error.message === 'INTERVIEW_NOT_FOUND') {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    if (error.message === 'NO_BOOKING_TO_CANCEL') {
      return NextResponse.json({ error: 'No booking to cancel' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 });
  }
}
