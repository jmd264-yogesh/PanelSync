import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@server/lib/session';
import { interviewsService } from '@server/services/interviews/interviews.service';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check and send feedback reminders via service
    const result = await interviewsService.checkAndSendFeedbackReminders(token);

    return NextResponse.json({
      success: true,
      reminders: result.sentCount,
    });
  } catch (error) {
    console.error('Failed to process feedback reminders:', error);
    return NextResponse.json({ error: 'Failed to send reminders' }, { status: 500 });
  }
}
