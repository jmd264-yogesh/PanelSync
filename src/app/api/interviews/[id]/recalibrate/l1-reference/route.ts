import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';
import { canViewPriorRound, parseRound } from '@/lib/interview-role';

export const dynamic = 'force-dynamic';

// Read-only L1-round reference for an L2 panelist scoring the same candidate: what the L1
// panel decided and wrote, plus the L1 Recalibrate assessment when one was submitted.
// Works for lateral and campus hiring.
//
// One-directional by design: access requires being assigned to THIS L2 interview, and
// anything that isn't an L2 round is refused. There is no equivalent route for an L1
// panelist to see L2 data — that visibility simply doesn't exist anywhere.
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
    if (!canViewPriorRound(parseRound(interview.role), 'L1')) {
      return NextResponse.json({ error: 'Earlier-round feedback is only available from an L2 round.' }, { status: 403 });
    }

    // Same candidate, same hiring track, an L1 round — one candidate can have several
    // (one per panelist, or a re-requested L1), so look at all of them.
    const candidateInterviews = await db.getInterviewsForEmail(interview.candidateEmail);
    const l1Interviews = candidateInterviews
      .filter((i) => i.hiringType === interview.hiringType && i.id !== interview.id && parseRound(i.role) === 'L1')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (l1Interviews.length === 0) {
      return NextResponse.json({ error: 'No L1 round found for this candidate.' }, { status: 404 });
    }

    // Every submitted L1 panelist's decision and written feedback.
    const panelFeedbacks = l1Interviews.flatMap((l1) =>
      l1.panels
        .filter((p) => p.status === 'SUBMITTED')
        .map((p) => ({
          panelId: p.id,
          panelistName: p.name,
          decision: p.decision ?? null,
          feedback: p.feedback ?? null,
          submittedAt: p.submittedAt ?? null,
        })),
    );

    // The newest L1 interview whose Recalibrate assessment was actually submitted — not
    // just the newest interview, or an unsubmitted newer one would hide a finished L1.
    let recalibrate: {
      positionTitle: string;
      session: NonNullable<Awaited<ReturnType<typeof db.getRecalibrateSession>>>;
      spec: unknown;
      questions: unknown;
    } | null = null;
    for (const l1 of l1Interviews) {
      const found = await db.getRecalibrateSession(l1.id);
      if (!found?.submittedAt) continue;
      const aiRun = found.aiRunId ? await db.getAiRun(found.aiRunId) : null;
      recalibrate = { positionTitle: l1.role, session: found, spec: aiRun?.spec ?? null, questions: aiRun?.questions ?? null };
      break;
    }

    if (panelFeedbacks.length === 0 && !recalibrate) {
      return NextResponse.json({ error: 'The L1 panel has not submitted any feedback yet.' }, { status: 404 });
    }

    return NextResponse.json({
      candidateName: l1Interviews[0].candidateName,
      positionTitle: recalibrate?.positionTitle ?? l1Interviews[0].role,
      panelFeedbacks,
      // Recalibrate fields stay at the top level for the existing reference panel.
      session: recalibrate?.session ?? null,
      spec: recalibrate?.spec ?? null,
      questions: recalibrate?.questions ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch L1 reference:', error);
    return NextResponse.json({ error: 'Failed to fetch L1 reference' }, { status: 500 });
  }
}
