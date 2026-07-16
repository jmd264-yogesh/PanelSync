import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db, AiRun } from '@/lib/db';
import { blob } from '@/lib/blob';
import { extractResumeText, ResumeUnreadableError } from '@/lib/ai/extract-text';
import { redactPII } from '@/lib/ai/redact';
import { getAiProvider } from '@/lib/ai/provider';
import { buildDigestPrompt, buildQuestionPrompt, buildSpecQuestionPrompt, PROMPT_VERSION } from '@/lib/ai/prompts';
import { ResumeDigestSchema, CriteriaSchema, QuestionSetSchema, SpecSchema } from '@/lib/ai/schemas';
import { verifyQuestionSet, QuestionSetVerificationError } from '@/lib/ai/verify';
import { sortByDifficulty } from '@/lib/ai/spec-catalog';
import { deriveFocusAreas } from '@/lib/ai/org-rubric';

export const dynamic = 'force-dynamic';

function sanitizeRun(run: AiRun) {
  if (!run.resumeDigest) return run;
  const { _sourceSha256, ...digest } = run.resumeDigest as any;
  return { ...run, resumeDigest: digest };
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

    const runs = await db.getAiRunsForInterview(id);
    return NextResponse.json(runs.map(sanitizeRun));
  } catch (error) {
    console.error('Failed to fetch AI runs:', error);
    return NextResponse.json({ error: 'Failed to fetch AI runs' }, { status: 500 });
  }
}

export async function POST(
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

    if (body.spec) {
      const parsedSpec = SpecSchema.safeParse(body.spec);
      if (!parsedSpec.success) {
        return NextResponse.json({ error: 'Invalid spec', details: parsedSpec.error.issues }, { status: 400 });
      }
      const spec = parsedSpec.data;

      let specRun = await db.createAiRun({ interviewId: id, candidateId: null, triggeredByEmail: session.user.email });
      const specProvider = getAiProvider();

      try {
        specRun = await db.updateAiRun(specRun.id, { status: 'GENERATING', spec });
        const focusAreas = deriveFocusAreas(spec.roleGrade);
        const { systemPrompt, userPrompt } = buildSpecQuestionPrompt(spec, focusAreas);
        const questionResult = await specProvider.generateStructured({
          systemPrompt,
          userPrompt,
          zodSchema: QuestionSetSchema,
        });

        verifyQuestionSet(questionResult.data, focusAreas);
        const ordered = { ...questionResult.data, questions: sortByDifficulty(questionResult.data.questions) };

        specRun = await db.updateAiRun(specRun.id, {
          status: 'COMPLETED',
          questions: ordered,
          model: questionResult.model,
          promptVersion: PROMPT_VERSION,
          completedAt: new Date(),
        });

        return NextResponse.json(sanitizeRun(specRun));
      } catch (err) {
        const message = err instanceof QuestionSetVerificationError ? err.message : 'AI run failed. Please try again.';
        console.error(`AI run ${specRun.id} failed:`, err);
        await db.updateAiRun(specRun.id, { status: 'FAILED', error: message, completedAt: new Date() });
        return NextResponse.json({ error: message }, { status: 422 });
      }
    }

    let criteria = null;
    if (body.criteria) {
      const parsedCriteria = CriteriaSchema.safeParse(body.criteria);
      if (!parsedCriteria.success) {
        return NextResponse.json({ error: 'Invalid criteria', details: parsedCriteria.error.issues }, { status: 400 });
      }
      criteria = parsedCriteria.data;
    }

    const candidate = await db.getCandidateForInterview(id);
    if (!candidate || !candidate.resumeFileKey || !candidate.resumeSha256) {
      return NextResponse.json({ error: 'No resume on file for this interview.' }, { status: 400 });
    }

    let run = await db.createAiRun({
      interviewId: id,
      candidateId: candidate.id,
      triggeredByEmail: session.user.email,
    });

    const provider = getAiProvider();

    try {
      let digest = await db.getLatestCompletedDigest(candidate.id, candidate.resumeSha256);

      if (!digest) {
        run = await db.updateAiRun(run.id, { status: 'PARSING' });
        const { buffer, contentType } = await blob.fetchResume(candidate.resumeFileKey);
        const rawText = await extractResumeText(buffer, contentType);
        const redactedText = redactPII(rawText, candidate.name, candidate.email);

        run = await db.updateAiRun(run.id, { status: 'EXTRACTING' });
        const { systemPrompt, userPrompt } = buildDigestPrompt(redactedText);
        const digestResult = await provider.generateStructured({
          systemPrompt,
          userPrompt,
          zodSchema: ResumeDigestSchema,
        });
        digest = { ...digestResult.data, _sourceSha256: candidate.resumeSha256 };

        run = await db.updateAiRun(run.id, {
          resumeDigest: digest,
          model: digestResult.model,
          promptVersion: PROMPT_VERSION,
          tokenUsage: digestResult.tokenUsage,
        });
      } else {
        run = await db.updateAiRun(run.id, { resumeDigest: digest });
      }

      if (!criteria) {
        run = await db.updateAiRun(run.id, { status: 'COMPLETED', criteria: criteria ?? undefined, completedAt: new Date() });
        return NextResponse.json(sanitizeRun(run));
      }

      run = await db.updateAiRun(run.id, { status: 'GENERATING', criteria });
      const { _sourceSha256, ...digestForPrompt } = digest as any;
      const { systemPrompt, userPrompt } = buildQuestionPrompt(digestForPrompt, criteria);
      const questionResult = await provider.generateStructured({
        systemPrompt,
        userPrompt,
        zodSchema: QuestionSetSchema,
      });

      verifyQuestionSet(questionResult.data, criteria.focusAreas);

      run = await db.updateAiRun(run.id, {
        status: 'COMPLETED',
        questions: questionResult.data,
        model: questionResult.model,
        promptVersion: PROMPT_VERSION,
        completedAt: new Date(),
      });

      return NextResponse.json(sanitizeRun(run));
    } catch (err) {
      const message = err instanceof ResumeUnreadableError || err instanceof QuestionSetVerificationError
        ? err.message
        : 'AI run failed. Please try again.';
      console.error(`AI run ${run.id} failed:`, err);
      await db.updateAiRun(run.id, { status: 'FAILED', error: message, completedAt: new Date() });
      return NextResponse.json({ error: message }, { status: 422 });
    }
  } catch (error) {
    console.error('Failed to create AI run:', error);
    return NextResponse.json({ error: 'Failed to create AI run' }, { status: 500 });
  }
}
