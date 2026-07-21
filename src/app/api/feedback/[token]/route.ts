import { NextRequest, NextResponse } from 'next/server';
import { feedbackService } from '@server/services/feedback/feedback.service';

/**
 * POST /api/feedback/[token]
 * Token-based (no login required) feedback submission.
 * Panelists click the reminder link, land on /feedback/[token], and POST here.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const result = await feedbackService.getInterviewByToken(token);
    const { interview, panel } = result;
    return NextResponse.json({ interview, panel });
  } catch (error) {
    console.error('Failed to get interview:', error);
    const message = error instanceof Error ? error.message : 'Failed to get interview';
    const status = message.includes('Invalid') || message.includes('expired') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { feedback, decision } = body as { feedback?: string; decision?: string };

    const result = await feedbackService.submitFeedback(token, feedback, decision || '');
    return NextResponse.json(result);
  } catch (error) {
    console.error('Feedback submission failed:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('Invalid') || message.includes('expired') ? 404 :
                   message.includes('decision must be') || message.includes('only be submitted') ? 400 :
                   message.includes('editing window') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
