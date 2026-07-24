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
    const { interviewId, candidateName, candidateEmail } = body;

    // Validate required fields
    if (!interviewId || !candidateName) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const finalEmail = candidateEmail || 'pending@assign.com';

    // Assign candidate via service
    await interviewsService.assignCandidate(
      interviewId,
      candidateName,
      finalEmail,
      session.user.email,
      token
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to assign candidate:', error);

    if (error.message === 'INTERVIEW_NOT_FOUND') {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }

    if (error.message === 'INTERVIEW_ALREADY_ASSIGNED') {
      return NextResponse.json({ error: 'Interview already has an assigned candidate' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to assign candidate' }, { status: 500 });
  }
}
