import { NextRequest, NextResponse } from 'next/server';
import { db, dbClient } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

/**
 * POST /api/feedback/[token]
 * Token-based (no login required) feedback submission.
 * Panelists click the reminder link, land on /feedback/[token], and POST here.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const result = await db.getInterviewByPanelToken(token);
  if (!result) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
  }
  const { interview, panel } = result;
  return NextResponse.json({ interview, panel });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const result = await db.getInterviewByPanelToken(token);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    const { panel } = result;
    const body = await request.json();
    const { feedback, decision } = body as { feedback?: string; decision?: string };

    if (!decision || !['PASSED', 'REJECTED'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be PASSED or REJECTED' }, { status: 400 });
    }

    // Enforce: interview must be SCHEDULED before feedback can be submitted
    if (result.interview.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: 'Feedback can only be submitted after the interview is scheduled.' },
        { status: 400 }
      );
    }

    // Check 2-hour edit window if already submitted
    if (panel.status === 'SUBMITTED' && panel.submittedAt) {
      const elapsedMs = Date.now() - new Date(panel.submittedAt).getTime();
      if (elapsedMs > 2 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: 'The 2-hour feedback editing window has expired.' },
          { status: 403 }
        );
      }
    }

    // Submit feedback
    await db.submitPanelFeedback(panel.id, feedback || '', decision as 'PASSED' | 'REJECTED');

    // Auto-update candidate outcome status (same logic as panelist session route)
    try {
      const [interview] = await dbClient
        .select()
        .from(schema.interviews)
        .where(eq(schema.interviews.id, panel.interviewId))
        .limit(1);

      if (interview) {
        const [candidate] = await dbClient
          .select()
          .from(schema.uploadedCandidates)
          .where(eq(schema.uploadedCandidates.mappedInterviewId, interview.id))
          .limit(1);

        if (candidate) {
          const isL1 = interview.role.toLowerCase().includes('l1');
          const isL2 = interview.role.toLowerCase().includes('l2');

          let nextOutcomeStatus = candidate.outcomeStatus;
          let nextQueueStatus = 'MAPPED';
          let nextMappedInterviewId: string | null = interview.id;

          if (isL1) {
            if (decision === 'PASSED') {
              nextOutcomeStatus = 'PASSED_L1';
              nextQueueStatus = 'WAITING';
              nextMappedInterviewId = null;
            } else {
              nextOutcomeStatus = 'REJECTED';
            }
          } else if (isL2) {
            nextOutcomeStatus = decision === 'PASSED' ? 'PASSED_L2' : 'REJECTED';
          } else {
            nextOutcomeStatus = decision === 'PASSED' ? 'PASSED_L1' : 'REJECTED';
          }

          await dbClient
            .update(schema.uploadedCandidates)
            .set({ outcomeStatus: nextOutcomeStatus, status: nextQueueStatus, mappedInterviewId: nextMappedInterviewId })
            .where(eq(schema.uploadedCandidates.id, candidate.id));

          if (nextQueueStatus === 'WAITING') {
            await db.autoMapPendingCandidates();
          }
        }
      }
    } catch (err) {
      console.error('Auto-outcome update failed:', err);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback submission failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
