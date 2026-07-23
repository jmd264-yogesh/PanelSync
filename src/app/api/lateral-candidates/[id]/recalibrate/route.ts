import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

function deriveRound(role: string): 'L1' | 'L2' | null {
  const lower = role.toLowerCase();
  if (lower.includes('l2')) return 'L2';
  if (lower.includes('l1')) return 'L1';
  return null;
}

// Recruiter-facing read of a lateral candidate's Recalibrate assessment(s). A candidate
// can now have both an L1 and an L2 lateral interview — this returns one report per
// round that has been submitted, rather than assuming a single interview per candidate.
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

    const candidateInterviews = await db.getInterviewsForEmail(candidate.email);
    const lateralInterviews = candidateInterviews.filter((i) => i.hiringType === 'LATERAL');

    if (lateralInterviews.length === 0) {
      return NextResponse.json({ error: 'No interview scheduled for this candidate yet.' }, { status: 404 });
    }

    const rounds = [];
    for (const interview of lateralInterviews) {
      const round = deriveRound(interview.role);
      const recalibrateSession = await db.getRecalibrateSession(interview.id);
      if (!recalibrateSession || !recalibrateSession.submittedAt) continue;

      const aiRun = recalibrateSession.aiRunId ? await db.getAiRun(recalibrateSession.aiRunId) : null;
      rounds.push({
        round,
        interviewId: interview.id,
        session: recalibrateSession,
        spec: aiRun?.spec ?? null,
        questions: aiRun?.questions ?? null,
      });
    }

    if (rounds.length === 0) {
      return NextResponse.json({ error: 'This candidate has no submitted Recalibrate assessment yet.' }, { status: 404 });
    }

    // Most recently submitted round first.
    rounds.sort((a, b) => new Date(b.session.submittedAt!).getTime() - new Date(a.session.submittedAt!).getTime());

    return NextResponse.json({
      candidateName: candidate.name,
      positionTitle: candidate.positionTitle,
      rounds,
    });
  } catch (error) {
    console.error('Failed to fetch recalibrate report:', error);
    return NextResponse.json({ error: 'Failed to fetch recalibrate report' }, { status: 500 });
  }
}
