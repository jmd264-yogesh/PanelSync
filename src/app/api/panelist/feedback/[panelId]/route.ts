import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db, dbClient } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panelId: string }> }
) {
  const session = await getPanelistSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { panelId } = await params;
  const body = await request.json();
  const { feedback, decision } = body as { feedback?: string; decision?: string };

  if (!decision || !['PASSED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be PASSED or REJECTED' }, { status: 400 });
  }

  // 1. Fetch the interview panel row to verify permissions
  const [panel] = await dbClient
    .select()
    .from(schema.interviewPanels)
    .where(eq(schema.interviewPanels.id, panelId))
    .limit(1);

  if (!panel) {
    return NextResponse.json({ error: 'Interview panel not found' }, { status: 404 });
  }

  // Security check: ensure panel email matches the session user's email
  if (panel.email.toLowerCase() !== session.user.email.toLowerCase()) {
    return NextResponse.json(
      { error: 'Forbidden: You can only submit feedback for your own assigned interviews' },
      { status: 403 }
    );
  }

  // Enforce 2-hour editing window and L1 PASS finality checks if already submitted
  if (panel.status === 'SUBMITTED' && panel.submittedAt) {
    const elapsedMs = Date.now() - new Date(panel.submittedAt).getTime();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    if (elapsedMs > twoHoursMs) {
      return NextResponse.json(
        { error: 'The 2-hour feedback editing window has expired and cannot be modified' },
        { status: 403 }
      );
    }

    // Check if L1 PASS finality applies
    const [interview] = await dbClient
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.id, panel.interviewId))
      .limit(1);

    if (interview && interview.role.toLowerCase().includes('l1') && panel.decision === 'PASSED') {
      return NextResponse.json(
        { error: 'Cannot edit feedback once a candidate has been passed for L1' },
        { status: 403 }
      );
    }
  }

  // 2. Submit feedback in database
  await db.submitPanelFeedback(panelId, feedback || '', decision as 'PASSED' | 'REJECTED');

  // 3. Resolve candidate and auto-transition outcomeStatus based on round
  try {
    // Find the interview
    const [interview] = await dbClient
      .select()
      .from(schema.interviews)
      .where(eq(schema.interviews.id, panel.interviewId))
      .limit(1);

    if (interview) {
      // Find candidate mapped to this interview
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
            // Reset candidate to WAITING and clear mapping so they are ready for L2
            nextQueueStatus = 'WAITING';
            nextMappedInterviewId = null;
          } else {
            nextOutcomeStatus = 'REJECTED';
          }
        } else if (isL2) {
          if (decision === 'PASSED') {
            nextOutcomeStatus = 'PASSED_L2';
          } else {
            nextOutcomeStatus = 'REJECTED';
          }
        } else {
          // General / custom
          if (decision === 'PASSED') {
            nextOutcomeStatus = 'PASSED_L1';
          } else {
            nextOutcomeStatus = 'REJECTED';
          }
        }

        // Update candidate record
        await dbClient
          .update(schema.uploadedCandidates)
          .set({
            outcomeStatus: nextOutcomeStatus,
            status: nextQueueStatus,
            mappedInterviewId: nextMappedInterviewId,
          })
          .where(eq(schema.uploadedCandidates.id, candidate.id));

        // If reset to WAITING, trigger auto-map check for L2
        if (nextQueueStatus === 'WAITING') {
          await db.autoMapPendingCandidates();
        }
      }
    }
  } catch (err) {
    console.error('Failed to auto-update candidate outcome status on feedback submit:', err);
  }

  return NextResponse.json({ success: true });
}
