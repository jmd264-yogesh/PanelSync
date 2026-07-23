import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Read-only L1-round Recalibrate reference for an L2 lateral panelist — mirrors campus
// hiring's /api/panelist/l1-feedback access model: a panelist can only see this if they
// are actually assigned to the L2 round interview for this candidate. There is no
// equivalent route for L1 panelists to see L2 data — that visibility simply doesn't
// exist anywhere in this feature, by design.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPanelistSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const assigned = await db.isPanelistAssignedToInterview(session.user.email, id);
    if (!assigned) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const interview = await db.getInterview(id);
    if (!interview) {
      return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    }
    if (interview.hiringType !== 'LATERAL' || !interview.role.toLowerCase().includes('l2')) {
      return NextResponse.json({ error: 'This is only available from an L2 lateral round.' }, { status: 403 });
    }

    const candidateInterviews = await db.getInterviewsForEmail(interview.candidateEmail);
    const l1Interview = candidateInterviews
      .filter((i) => i.hiringType === 'LATERAL' && i.id !== interview.id && i.role.toLowerCase().includes('l1'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!l1Interview) {
      return NextResponse.json({ error: 'No L1 round found for this candidate.' }, { status: 404 });
    }

    const recalibrateSession = await db.getRecalibrateSession(l1Interview.id);
    if (!recalibrateSession || !recalibrateSession.submittedAt) {
      return NextResponse.json({ error: 'The L1 Recalibrate assessment has not been submitted yet.' }, { status: 404 });
    }

    const aiRun = recalibrateSession.aiRunId ? await db.getAiRun(recalibrateSession.aiRunId) : null;

    return NextResponse.json({
      candidateName: l1Interview.candidateName,
      positionTitle: l1Interview.role,
      session: recalibrateSession,
      spec: aiRun?.spec ?? null,
      questions: aiRun?.questions ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch L1 recalibrate reference:', error);
    return NextResponse.json({ error: 'Failed to fetch L1 reference' }, { status: 500 });
  }
}
