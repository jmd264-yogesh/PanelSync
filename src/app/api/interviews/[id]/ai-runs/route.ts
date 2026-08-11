import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db, AiRun } from '@/lib/db';
import { blob } from '@/lib/blob';
import { extractResumeText, ResumeUnreadableError } from '@/lib/ai/extract-text';
import { redactPII } from '@/lib/ai/redact';
import { getAiProvider } from '@/lib/ai/provider';
import { buildDigestPrompt, buildQuestionPrompt, PROMPT_VERSION } from '@/lib/ai/prompts';
import { ResumeDigestSchema, CriteriaSchema, QuestionSetSchema, SpecSchema } from '@/lib/ai/schemas';
import { verifyQuestionSet, recomputeTotalMarks, QuestionSetVerificationError } from '@/lib/ai/verify';
import { deriveFocusAreas, BEHAVIOURAL_CATEGORIES, BEHAVIOURAL_CATEGORY_LABEL } from '@/lib/ai/org-rubric';
import { getInterviewInfo } from '@/lib/interview-role';
import { generateQuestionSetAgentic } from '@/lib/ai/generate';
import { AiError, classifyProviderError } from '@/lib/ai/errors';

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

      try {
        specRun = await db.updateAiRun(specRun.id, { status: 'GENERATING', spec });
        const focusAreas = deriveFocusAreas(spec.roleGrade, spec.techStacks);
        // Derived from the interview's own role string server-side (never trusted from
        // the client) so L1 vs L2 rounds get calibrated differently — L1 stays
        // foundational, L2 goes deeper technically and probes delivery/ownership.
        const interview = await db.getInterview(id);
        const round = interview ? getInterviewInfo(interview.role).round : 'GENERAL';

        const { questionSet, diagnostics, model, tokenUsage } = await generateQuestionSetAgentic({
          spec,
          focusAreas,
          behaviouralCategories: BEHAVIOURAL_CATEGORIES.map((c) => BEHAVIOURAL_CATEGORY_LABEL[c]),
          round: round === 'GENERAL' ? null : round,
        });

        specRun = await db.updateAiRun(specRun.id, {
          status: 'COMPLETED',
          questions: questionSet,
          model,
          promptVersion: PROMPT_VERSION,
          tokenUsage,
          completedAt: new Date(),
        });

        // Observability: one durable record per run of what the pipeline actually did —
        // retries, guardrail findings, whether the critic asked for (and got) a revision.
        // Without this, "the AI feels unreliable" stays unfalsifiable; with it, failure
        // rates and quality drift are queryable.
        await db.addAuditLog(session.user.email, 'AI_RUN_COMPLETED', 'AiRun', specRun.id, {
          interviewId: id,
          ...diagnostics,
          // The full finding objects are verbose; codes are what you aggregate on.
          finalFindings: diagnostics.finalFindings.map((f) => ({ code: f.code, severity: f.severity, questionId: f.questionId })),
        });

        return NextResponse.json(sanitizeRun(specRun));
      } catch (err) {
        const aiErr = err instanceof QuestionSetVerificationError
          ? new AiError('GUARDRAIL', err.message)
          : classifyProviderError(err);

        console.error(`AI run ${specRun.id} failed [${aiErr.kind}]:`, aiErr.message);
        await db.updateAiRun(specRun.id, { status: 'FAILED', error: `${aiErr.kind}: ${aiErr.message}`, completedAt: new Date() });
        await db.addAuditLog(session.user.email, 'AI_RUN_FAILED', 'AiRun', specRun.id, {
          interviewId: id,
          kind: aiErr.kind,
          status: aiErr.status,
          retryable: aiErr.retryable,
          message: aiErr.message.slice(0, 500),
        });

        // 429/503 are the caller's cue that retrying later is worthwhile; 422 means the
        // output was genuinely unusable and a retry may well produce the same thing.
        const httpStatus = aiErr.kind === 'RATE_LIMIT' ? 429
          : aiErr.kind === 'OVERLOADED' || aiErr.kind === 'SERVER' ? 503
            : aiErr.kind === 'TIMEOUT' ? 504
              : aiErr.kind === 'AUTH' ? 500
                : 422;

        return NextResponse.json(
          { error: aiErr.userMessage, kind: aiErr.kind, retryable: aiErr.retryable },
          { status: httpStatus },
        );
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

      const recomputed = recomputeTotalMarks(questionResult.data);
      verifyQuestionSet(recomputed, criteria.focusAreas);

      run = await db.updateAiRun(run.id, {
        status: 'COMPLETED',
        questions: recomputed,
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
