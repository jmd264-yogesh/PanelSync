import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db, type AiTranscriptEvaluation } from '@/lib/db';
import {
  TranscriptError,
  fetchTranscriptVtt,
  listTranscripts,
  resolveOnlineMeetingId,
} from '@/lib/graph-transcript';
import { analyseTranscript, parseDialogueTurns } from '@/lib/transcript';
import { transcribeAudioWithAi, evaluateTranscriptWithAi } from '@/lib/ai/transcript-evaluator';

export const dynamic = 'force-dynamic';

// Pulling a 45-minute transcript out of Graph and back is not a fast request.
export const maxDuration = 60;

/** Shared auth + identity resolution for both verbs */
async function loadContext(interviewId: string, email: string) {
  const assigned = await db.isPanelistAssignedToInterview(email, interviewId);
  if (!assigned) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const interview = await db.getInterview(interviewId);
  if (!interview) return { error: NextResponse.json({ error: 'Interview not found' }, { status: 404 }) };

  return { interview };
}

function analysisFor(interview: NonNullable<Awaited<ReturnType<typeof db.getInterview>>>, vtt: string) {
  return analyseTranscript(vtt, {
    candidateName: interview.candidateName,
    candidateEmail: interview.candidateEmail,
    panelistNames: interview.panels.map((p) => p.name),
  });
}

// GET — whatever transcript we have stored in the session or Graph DB.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPanelistSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const ctx = await loadContext(id, session.user.email);
    if (ctx.error) return ctx.error;

    const recalSession = await db.getOrCreateRecalibrateSession(id);
    const stored = await db.getInterviewTranscripts(id);
    const combinedVtt = stored.map((t) => t.contentVtt ?? '').filter(Boolean).join('\n\n');

    return NextResponse.json({
      hasTranscript: false,
      // transcriptText: recalSession.transcriptText || combinedVtt || null,
      // transcriptTurns: recalSession.transcriptTurns || null,
      // aiEvaluation: recalSession.aiEvaluation || null,
      // fetchedAt: recalSession.transcriptFetchedAt || stored[0]?.fetchedAt || null,
      // transcriptSource: recalSession.transcriptSource || (stored.length > 0 ? 'graph_api' : null),
      // transcriptCount: stored.length,
      // analysis: combinedVtt ? analysisFor(ctx.interview, combinedVtt) : null,
      // session: recalSession,
    });
  } catch (error) {
    console.error('Failed to read stored transcript:', error);
    return NextResponse.json({ error: 'Failed to read transcript' }, { status: 500 });
  }
}

// POST — multi-source router: Audio transcription, Manual text upload, or Teams Graph sync
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPanelistSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const ctx = await loadContext(id, session.user.email);
    if (ctx.error) return ctx.error;
    const interview = ctx.interview;

    const body = await request.json().catch(() => ({}));
    const rawSource = String(body.source || '').toLowerCase().trim();

    // Determine target mode
    const isAudio =
      rawSource === 'audio' ||
      rawSource === 'live_recording' ||
      rawSource === 'audio_upload' ||
      Boolean(body.audios) ||
      Boolean(body.audioBase64);

    const isText =
      rawSource === 'text' ||
      rawSource === 'manual' ||
      rawSource === 'manual_upload' ||
      Boolean(body.transcriptText) ||
      Boolean(body.rawTranscript);

    const isGraph = rawSource === 'graph' || rawSource === 'teams' || rawSource === 'graph_api';

    // 1. AUDIO TRANSCRIPTION (from live recording or uploaded audio file)
    if (isAudio) {
      const audios: Array<{ audioBase64: string; mimeType: string }> = Array.isArray(body.audios) && body.audios.length > 0
        ? body.audios
        : (body.audioBase64 ? [{ audioBase64: body.audioBase64, mimeType: body.mimeType || 'audio/webm' }] : []);

      if (audios.length === 0) {
        return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
      }

      // Fetch existing session and previous transcript so audio takes are cumulative
      const recalSession = await db.getOrCreateRecalibrateSession(id);
      const previousTranscript = recalSession.transcriptText || '';

      let combinedTranscript = '';
      for (const audioItem of audios) {
        const transResult = await transcribeAudioWithAi({
          audioBase64: audioItem.audioBase64,
          mimeType: audioItem.mimeType,
          candidateName: interview.candidateName,
          roleTitle: interview.role,
          existingTranscriptText: combinedTranscript || previousTranscript || null,
        });

        if (transResult.transcriptText && !transResult.transcriptText.toLowerCase().includes('no speech detected')) {
          if (combinedTranscript) {
            combinedTranscript += '\n\n' + transResult.transcriptText.trim();
          } else {
            combinedTranscript = transResult.transcriptText.trim();
          }
        }
      }

      // Build cumulative transcript combining previous takes and new take
      const fullTranscript = previousTranscript
        ? (combinedTranscript ? `${previousTranscript}\n\n${combinedTranscript}` : previousTranscript)
        : combinedTranscript;

      const turns = parseDialogueTurns(fullTranscript);

      // Fetch AI questions for evaluation
      let evaluation: AiTranscriptEvaluation | null = null;
      let evaluationError: string | null = null;
      const targetAiRunId = body.aiRunId || recalSession.aiRunId;
      let run = targetAiRunId ? await db.getAiRun(targetAiRunId) : null;
      if (!run) {
        const runs = await db.getAiRunsForInterview(id);
        run = runs.find((r) => r.status === 'COMPLETED' && r.questions) || runs[0] || null;
      }

      const questionsToUse = run?.questions || body.questionSet || null;
      const specToUse = run?.spec || body.spec || null;

      if (questionsToUse && fullTranscript.trim()) {
        try {
          evaluation = await evaluateTranscriptWithAi({
            transcriptText: fullTranscript,
            questionSet: questionsToUse as any,
            spec: specToUse as any,
            candidateName: interview.candidateName,
            roleTitle: interview.role,
          });
        } catch (evalErr: any) {
          console.error('Failed to run AI evaluation on transcript:', evalErr);
          evaluationError = evalErr?.message || String(evalErr);
        }
      } else {
        if (!questionsToUse) {
          console.warn('AI evaluation skipped: No question set found for interview', id);
          evaluationError = 'No question set found for this interview. Please generate questions first.';
        } else if (!fullTranscript.trim()) {
          console.warn('AI evaluation skipped: Empty transcript for interview', id);
          evaluationError = 'No audible speech was detected in the audio recording.';
        }
      }

      // Preserve previous evaluation if the new evaluation attempt failed or returned null
      const finalEvaluation = evaluation || (recalSession.aiEvaluation as any) || null;

      const sourceType = body.sourceType || (body.audios ? 'live_recording' : 'audio_upload');
      const updatedSession = await db.updateRecalibrateSession(id, {
        aiRunId: targetAiRunId || run?.id || recalSession.aiRunId || null,
        transcriptText: fullTranscript || null,
        transcriptTurns: turns.length > 0 ? turns : null,
        aiEvaluation: finalEvaluation,
        transcriptFetchedAt: new Date(),
        transcriptSource: sourceType,
      });

      await db.addAuditLog(session.user.email, 'AUDIO_TRANSCRIBED', 'Interview', id, {
        chunksCount: audios.length,
        characters: fullTranscript.length,
        hasEvaluation: Boolean(finalEvaluation),
      });

      return NextResponse.json({
        success: true,
        session: updatedSession,
        evaluation: finalEvaluation,
        evaluationError,
        // transcriptText and transcriptTurns kept commented out so raw transcript text is not returned
      });
    }

    // 2. TEXT TRANSCRIPT UPLOAD
    if (isText) {
      const rawText = String(body.transcriptText || body.rawTranscript || '').trim();
      if (!rawText) {
        return NextResponse.json({ error: 'Transcript text cannot be empty' }, { status: 400 });
      }

      const turns = parseDialogueTurns(rawText);
      const recalSession = await db.getOrCreateRecalibrateSession(id);
      let evaluation: AiTranscriptEvaluation | null = null;

      let run = recalSession.aiRunId ? await db.getAiRun(recalSession.aiRunId) : null;
      if (!run) {
        const runs = await db.getAiRunsForInterview(id);
        run = runs.find((r) => r.status === 'COMPLETED' && r.questions) || null;
      }

      if (run?.questions) {
        try {
          evaluation = await evaluateTranscriptWithAi({
            transcriptText: rawText,
            questionSet: run.questions as any,
            spec: run.spec as any,
            candidateName: interview.candidateName,
            roleTitle: interview.role,
          });
        } catch (evalErr) {
          console.error('Failed to run AI evaluation on text transcript:', evalErr);
        }
      }

      const updatedSession = await db.updateRecalibrateSession(id, {
        transcriptText: rawText,
        transcriptTurns: turns.length > 0 ? turns : null,
        aiEvaluation: evaluation,
        transcriptFetchedAt: new Date(),
        transcriptSource: 'manual_upload',
      });

      return NextResponse.json({
        success: true,
        session: updatedSession,
        evaluation: evaluation || (recalSession.aiEvaluation as any) || null,
        // transcriptText: rawText,
        // transcriptTurns: turns,
      });
    }

    // 3. TEAMS GRAPH API SYNC (Only when explicitly requested)
    if (isGraph) {
      const identity = await db.getInterviewMeetingIdentity(id);
      if (!identity?.organizerUserId) {
        throw new TranscriptError(
          'NO_ORGANIZER',
          'This interview has no recorded meeting organizer, so its transcript cannot be located. Reschedule or start live audio recording instead.',
          409,
        );
      }
      if (!identity.teamsMeetingUrl) {
        throw new TranscriptError('MEETING_NOT_FOUND', 'This interview has no Teams meeting attached.', 409);
      }

      let onlineMeetingId = identity.onlineMeetingId;
      if (!onlineMeetingId) {
        onlineMeetingId = await resolveOnlineMeetingId(identity.organizerUserId, identity.teamsMeetingUrl);
        await db.setInterviewOnlineMeetingId(id, onlineMeetingId);
      }

      const available = await listTranscripts(identity.organizerUserId, onlineMeetingId);
      if (available.length === 0) {
        throw new TranscriptError(
          'NO_TRANSCRIPT',
          'Teams has no transcript for this meeting. Transcription has to be started during the call. Use "Live Record" to record audio directly from your browser.',
          404,
        );
      }

      for (const transcript of available) {
        const vtt = await fetchTranscriptVtt(identity.organizerUserId, onlineMeetingId, transcript.id);
        await db.saveInterviewTranscript({
          interviewId: id,
          graphTranscriptId: transcript.id,
          contentVtt: vtt,
          transcriptCreatedAt: transcript.createdDateTime ? new Date(transcript.createdDateTime) : null,
          fetchedByEmail: session.user.email,
        });
      }

      const stored = await db.getInterviewTranscripts(id);
      const combinedVtt = stored.map((t) => t.contentVtt ?? '').filter(Boolean).join('\n\n');

      let evaluation: AiTranscriptEvaluation | null = null;
      const recalSession = await db.getOrCreateRecalibrateSession(id);
      let run = recalSession.aiRunId ? await db.getAiRun(recalSession.aiRunId) : null;
      if (!run) {
        const runs = await db.getAiRunsForInterview(id);
        run = runs.find((r) => r.status === 'COMPLETED' && r.questions) || null;
      }

      if (run?.questions && combinedVtt) {
        try {
          evaluation = await evaluateTranscriptWithAi({
            transcriptText: combinedVtt,
            questionSet: run.questions as any,
            spec: run.spec as any,
            candidateName: interview.candidateName,
            roleTitle: interview.role,
          });
        } catch (evalErr) {
          console.error('Failed to run AI evaluation on Teams transcript:', evalErr);
        }
      }

      const turns = combinedVtt ? parseDialogueTurns(combinedVtt) : [];
      const updatedSession = await db.updateRecalibrateSession(id, {
        transcriptText: combinedVtt,
        transcriptTurns: turns.length > 0 ? turns : null,
        aiEvaluation: evaluation,
        transcriptFetchedAt: new Date(),
        transcriptSource: 'graph_api',
      });

      await db.addAuditLog(session.user.email, 'TRANSCRIPT_SYNCED', 'Interview', id, {
        transcriptCount: stored.length,
        characters: combinedVtt.length,
      });

      return NextResponse.json({
        success: true,
        hasTranscript: false,
        evaluation: evaluation || (recalSession.aiEvaluation as any) || null,
        // fetchedAt: stored[0]?.fetchedAt ?? null,
        // transcriptCount: stored.length,
        // analysis: combinedVtt ? analysisFor(interview, combinedVtt) : null,
        // session: updatedSession,
        // transcriptText: combinedVtt,
        // transcriptTurns: turns,
      });
    }

    // Fallback: If source was not recognized, return explicit error instead of triggering Graph sync
    return NextResponse.json(
      { error: 'Missing or unsupported transcript source. Supported sources: "audio", "text", or "graph".' },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof TranscriptError) {
      console.error(`Transcript sync failed for ${id} [${error.code}]:`, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Transcript processing failed:', error);
    return NextResponse.json({ error: 'Failed to process transcript.' }, { status: 500 });
  }
}
