import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db, AiRun } from '@/lib/db';
import { QuestionSetSchema, Spec } from '@/lib/ai/schemas';
import { verifyQuestionSet, QuestionSetVerificationError } from '@/lib/ai/verify';
import { deriveFocusAreas } from '@/lib/ai/org-rubric';

export const dynamic = 'force-dynamic';

function sanitizeRun(run: AiRun) {
  if (!run.resumeDigest) return run;
  const { _sourceSha256, ...digest } = run.resumeDigest as any;
  return { ...run, resumeDigest: digest };
}

// Persists panelist edits to a run's proposed questions/rubric (e.g. rewording a
// question, adjusting marks). The AI's original proposal for this run stays
// recoverable via run history — this overwrites only the "in-use" copy.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const session = await getPanelistSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, runId } = await params;
    const assigned = await db.isPanelistAssignedToInterview(session.user.email, id);
    if (!assigned) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const run = await db.getAiRun(runId);
    if (!run || run.interviewId !== id) {
      return NextResponse.json({ error: 'AI run not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = QuestionSetSchema.safeParse(body.questions);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid questions payload', details: parsed.error.issues }, { status: 400 });
    }

    if (run.criteria || run.spec) {
      try {
        const focusAreas = run.criteria ? (run.criteria as any).focusAreas : deriveFocusAreas((run.spec as Spec).roleGrade);
        verifyQuestionSet(parsed.data, focusAreas);
      } catch (err) {
        if (err instanceof QuestionSetVerificationError) {
          return NextResponse.json({ error: err.message }, { status: 422 });
        }
        throw err;
      }
    }

    const updated = await db.updateAiRun(runId, { questions: parsed.data });
    await db.addAuditLog(session.user.email, 'QUESTIONS_EDITED', 'AiRun', runId, {});

    return NextResponse.json(sanitizeRun(updated));
  } catch (error) {
    console.error('Failed to update AI run questions:', error);
    return NextResponse.json({ error: 'Failed to update questions' }, { status: 500 });
  }
}
