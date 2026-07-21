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
    const { interviewId, panelId } = body;

    if (!interviewId || !panelId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Resend invite via service
    await interviewsService.resendInvite(interviewId, panelId, token);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to resend invite:', error);

    if (error.message === 'INTERVIEW_NOT_FOUND') {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    if (error.message === 'PANEL_NOT_FOUND') {
      return NextResponse.json({ error: 'Panelist nomination not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to resend invite' }, { status: 500 });
  }
}
