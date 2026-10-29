import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Org rubric scale: 1 Does Not Meet .. 4 Exceeds Expectation — applies to both the
// per-question scores and the Overall Scoring Rubric grid.
function isValidScoreMap(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (v) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4
  );
}

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

    const recalibrateSession = await db.getOrCreateRecalibrateSession(id);
    const lateralCandidate = await db.getLateralCandidateForInterview(id);
    const interview = await db.getInterview(id);

    return NextResponse.json({
      session: recalibrateSession,
      roleGrade: lateralCandidate?.roleGrade ?? null,
      // For the in-person "who is who" step: panelists to choose from.
      panelNames: interview?.panels.map((p) => p.name).filter(Boolean) ?? [],
    });
  } catch (error) {
    console.error('Failed to fetch recalibrate session:', error);
    return NextResponse.json({ error: 'Failed to fetch recalibrate session' }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json().catch(() => ({}));
    const patch: Partial<{
      aiRunId: string | null;
      questionScores: Record<string, number>;
      rubricScores: Record<string, number>;
      notes: string | null;
      timerStartedAt: Date | null;
      timerEndedAt: Date | null;
      elapsedSeconds: number;
      submittedAt: Date | null;
      submittedBy: string | null;
      aiEvaluation: any;
      interviewMode: 'ONLINE' | 'IN_PERSON';
    }> = {};

    if (body.interviewMode !== undefined) {
      if (body.interviewMode !== 'ONLINE' && body.interviewMode !== 'IN_PERSON') {
        return NextResponse.json({ error: "interviewMode must be 'ONLINE' or 'IN_PERSON'" }, { status: 400 });
      }
      patch.interviewMode = body.interviewMode;
    }

    if (body.aiEvaluation !== undefined) {
      patch.aiEvaluation = body.aiEvaluation;
    }

    if (body.aiRunId !== undefined) {
      if (body.aiRunId !== null && typeof body.aiRunId !== 'string') {
        return NextResponse.json({ error: 'aiRunId must be a string or null' }, { status: 400 });
      }
      patch.aiRunId = body.aiRunId;
    }
    if (body.questionScores !== undefined) {
      if (!isValidScoreMap(body.questionScores)) {
        return NextResponse.json({ error: 'questionScores must map question IDs to integers 1-4' }, { status: 400 });
      }
      patch.questionScores = body.questionScores;
    }
    if (body.rubricScores !== undefined) {
      if (!isValidScoreMap(body.rubricScores)) {
        return NextResponse.json({ error: 'rubricScores must map dimension labels to integers 1-4' }, { status: 400 });
      }
      patch.rubricScores = body.rubricScores;
    }
    if (body.notes !== undefined) {
      if (body.notes !== null && typeof body.notes !== 'string') {
        return NextResponse.json({ error: 'notes must be a string or null' }, { status: 400 });
      }
      patch.notes = body.notes;
    }
    if (body.timerStartedAt !== undefined) {
      patch.timerStartedAt = body.timerStartedAt === null ? null : new Date(body.timerStartedAt);
    }
    if (body.elapsedSeconds !== undefined) {
      if (!Number.isInteger(body.elapsedSeconds) || body.elapsedSeconds < 0 || body.elapsedSeconds > 7 * 24 * 3600) {
        return NextResponse.json({ error: 'elapsedSeconds must be a whole number of seconds' }, { status: 400 });
      }
      patch.elapsedSeconds = body.elapsedSeconds;
    }
    // `submitted` is a trusted server-side flag — the client can't set submittedBy/submittedAt
    // directly, so a recruiter-visible submission is always attributable to the real panelist.
    if (body.submitted !== undefined) {
      if (typeof body.submitted !== 'boolean') {
        return NextResponse.json({ error: 'submitted must be a boolean' }, { status: 400 });
      }
      patch.submittedAt = body.submitted ? new Date() : null;
      patch.submittedBy = body.submitted ? session.user.email : null;
    }

    const updated = await db.updateRecalibrateSession(id, patch);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update recalibrate session:', error);
    return NextResponse.json({ error: 'Failed to update recalibrate session' }, { status: 500 });
  }
}
