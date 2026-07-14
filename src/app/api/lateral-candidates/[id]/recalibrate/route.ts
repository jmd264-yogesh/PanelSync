import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Recruiter-facing read of a lateral candidate's Recalibrate assessment. Only ever
// exposes a session the panelist has explicitly submitted — draft/in-progress scoring
// stays panelist-only.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const candidate = await db.getLateralCandidate(id);
    if (!candidate) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    if (!candidate.mappedInterviewId) {
      return NextResponse.json({ error: 'No interview scheduled for this candidate yet.' }, { status: 404 });
    }

    const recalibrateSession = await db.getRecalibrateSession(candidate.mappedInterviewId);
    if (!recalibrateSession || !recalibrateSession.submittedAt) {
      return NextResponse.json({ error: 'This candidate has no submitted Recalibrate assessment yet.' }, { status: 404 });
    }

    const aiRun = recalibrateSession.aiRunId ? await db.getAiRun(recalibrateSession.aiRunId) : null;

    return NextResponse.json({
      candidateName: candidate.name,
      positionTitle: candidate.positionTitle,
      session: recalibrateSession,
      spec: aiRun?.spec ?? null,
      questions: aiRun?.questions ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch recalibrate report:', error);
    return NextResponse.json({ error: 'Failed to fetch recalibrate report' }, { status: 500 });
  }
}
