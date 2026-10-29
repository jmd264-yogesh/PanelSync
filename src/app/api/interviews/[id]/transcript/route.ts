import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db, type AiTranscriptEvaluation, type RecalibrateSession, type SpeakerMap, type TranscriptDialogueTurn } from '@/lib/db';
import {
  TranscriptError,
  fetchTranscriptVtt,
  listTranscripts,
  resolveOnlineMeetingId,
} from '@/lib/graph-transcript';
import { analyseTranscript, attributeSpeakers, formatTimestamp, parseDialogueTurns, parseVtt } from '@/lib/transcript';
import { transcribeAudioWithAi, evaluateTranscriptWithAi, isTranscriptEmptyOrNoSpeech, suggestSpeakerRoles } from '@/lib/ai/transcript-evaluator';
import {
  applySpeakerMap, buildRoleTaggedTranscript, mergeSpeakerMaps, speakerLabels, summarizeSpeakers, validateSpeakerMap,
} from '@/lib/in-person';
import { uploadAudioBase64, type UploadAudioResult } from '@/lib/s3';
import type { Spec } from '@/lib/ai/schemas';

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

type InterviewRecord = NonNullable<Awaited<ReturnType<typeof db.getInterview>>>;

/** The question run a transcript is evaluated against: explicit, then the session's, then the latest completed. */
async function resolveQuestionRun(interviewId: string, recalSession: RecalibrateSession, preferredRunId?: string | null) {
  const targetAiRunId = preferredRunId || recalSession.aiRunId;
  let run = targetAiRunId ? await db.getAiRun(targetAiRunId) : null;
  if (!run) {
    const runs = await db.getAiRunsForInterview(interviewId);
    run = runs.find((r) => r.status === 'COMPLETED' && r.questions) || runs[0] || null;
  }
  return run;
}

interface EvaluationOutcome {
  evaluation: AiTranscriptEvaluation | null;
  evaluationError: string | null;
  runId: string | null;
}

/**
 * Evaluates a transcript against the interview's question set and always says WHY when it
 * can't — a silent null is what left panelists with a transcript, no AI scores and no clue
 * (or button) to fix it.
 */
async function evaluateAgainstRun(params: {
  interview: InterviewRecord;
  recalSession: RecalibrateSession;
  transcriptText: string;
  preferredRunId?: string | null;
  fallbackQuestions?: unknown;
  fallbackSpec?: Spec | null;
  speakersConfirmed?: boolean;
}): Promise<EvaluationOutcome> {
  const { interview, recalSession, transcriptText, preferredRunId, fallbackQuestions, fallbackSpec, speakersConfirmed } = params;
  const run = await resolveQuestionRun(interview.id, recalSession, preferredRunId);
  const questionSet = run?.questions || fallbackQuestions || null;
  const spec = (run?.spec as Spec | null | undefined) || fallbackSpec || null;
  const runId = run?.id || recalSession.aiRunId || null;

  if (!questionSet) {
    return { evaluation: null, evaluationError: 'No question set found for this interview. Generate questions first, then run the AI evaluation.', runId };
  }
  if (!transcriptText.trim()) {
    return { evaluation: null, evaluationError: 'There is no transcript to evaluate yet.', runId };
  }
  try {
    const evaluation = await evaluateTranscriptWithAi({
      transcriptText,
      questionSet,
      spec,
      candidateName: interview.candidateName,
      roleTitle: interview.role,
      speakersConfirmed,
    });
    return { evaluation, evaluationError: null, runId };
  } catch (err) {
    console.error('AI evaluation failed:', err);
    return { evaluation: null, evaluationError: err instanceof Error ? err.message : String(err), runId };
  }
}

/**
 * In-person: stop after transcription and ask a panelist to confirm who is who. Stores
 * the neutral-label transcript (the source of truth, also used as continuation context
 * for later clips), suggests roles, and clears any previous evaluation — nothing is
 * scored on guessed speakers.
 */
async function prepareSpeakerReview(params: {
  interview: InterviewRecord;
  recalSession: RecalibrateSession;
  transcriptText: string;
  keepPreviousMapping: boolean;
  extra: Partial<Parameters<typeof db.updateRecalibrateSession>[1]>;
}) {
  const { interview, recalSession, transcriptText, keepPreviousMapping, extra } = params;
  const turns = parseDialogueTurns(transcriptText);
  const labels = speakerLabels(turns);
  const summaries = summarizeSpeakers(turns);

  const suggested: SpeakerMap = {};
  if (labels.length > 0) {
    try {
      const result = await suggestSpeakerRoles({
        speakers: summaries,
        candidateName: interview.candidateName,
        panelNames: interview.panels.map((p) => p.name),
        roleTitle: interview.role,
      });
      for (const sp of result.speakers) {
        if (!labels.includes(sp.label)) continue;
        suggested[sp.label] = {
          role: sp.role,
          name: sp.role === 'panelist' ? (sp.panelistName ?? undefined) : undefined,
          suggested: true,
          reason: sp.reason,
        };
      }
    } catch (err) {
      // A failed suggestion only means the panelist assigns every speaker by hand.
      console.error('Speaker role suggestion failed:', err);
    }
  }

  const speakerMap = mergeSpeakerMaps(keepPreviousMapping ? recalSession.speakerMap : null, suggested, labels);
  return db.updateRecalibrateSession(interview.id, {
    ...extra,
    transcriptText: transcriptText || null,
    transcriptTurns: turns.length > 0 ? turns : null,
    speakerMap,
    speakersConfirmedAt: null,
    aiEvaluation: null,
    transcriptFetchedAt: new Date(),
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

    // RE-RUN AI EVALUATION on the transcript already stored for this interview — for when
    // the first evaluation failed or was skipped (no questions yet), or the questions were
    // regenerated. In person this scores the confirmed, role-tagged transcript only.
    if (rawSource === 'evaluate') {
      const recalSession = await db.getOrCreateRecalibrateSession(id);
      const inPerson = recalSession.interviewMode === 'IN_PERSON';
      if (!recalSession.transcriptText?.trim()) {
        return NextResponse.json({ error: 'There is no transcript to evaluate yet. Record, upload or fetch one first.' }, { status: 400 });
      }
      if (inPerson && !recalSession.speakersConfirmedAt) {
        return NextResponse.json({ error: 'Confirm who is who before the AI evaluates an in-person transcript.' }, { status: 409 });
      }

      const transcriptForEval = inPerson
        ? buildRoleTaggedTranscript((recalSession.transcriptTurns ?? []).filter((t) => t.role))
        : recalSession.transcriptText;

      const { evaluation, evaluationError, runId } = await evaluateAgainstRun({
        interview,
        recalSession,
        transcriptText: transcriptForEval,
        preferredRunId: body.aiRunId,
        speakersConfirmed: inPerson,
      });
      if (!evaluation) {
        return NextResponse.json({ success: false, error: evaluationError || 'AI evaluation failed.' }, { status: 422 });
      }

      const updatedSession = await db.updateRecalibrateSession(id, { aiRunId: runId, aiEvaluation: evaluation });
      await db.addAuditLog(session.user.email, 'TRANSCRIPT_REEVALUATED', 'Interview', id, { inPerson, runId });
      return NextResponse.json({ success: true, session: updatedSession, evaluation });
    }

    // 0. CONFIRM IN-PERSON SPEAKERS — apply the panelist's mapping, then evaluate.
    if (rawSource === 'speakers') {
      const recalSession = await db.getOrCreateRecalibrateSession(id);
      const rawTurns: TranscriptDialogueTurn[] = parseDialogueTurns(recalSession.transcriptText || '');
      const labels = speakerLabels(rawTurns);
      if (labels.length === 0) {
        return NextResponse.json({ error: 'There is no transcript to assign speakers for yet.' }, { status: 400 });
      }

      // Keep only known labels and well-formed assignments; the client never decides the label set.
      const incoming = (body.speakerMap && typeof body.speakerMap === 'object') ? body.speakerMap as Record<string, unknown> : {};
      const speakerMap: SpeakerMap = {};
      for (const label of labels) {
        const a = incoming[label] as { role?: unknown; name?: unknown } | undefined;
        if (!a || (a.role !== 'candidate' && a.role !== 'panelist' && a.role !== 'ignore')) continue;
        speakerMap[label] = {
          role: a.role,
          name: a.role === 'panelist' && typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 120) : undefined,
        };
      }
      const check = validateSpeakerMap(speakerMap, labels);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

      const confirmedTurns = applySpeakerMap(rawTurns, speakerMap, interview.candidateName);
      const { evaluation, evaluationError, runId } = await evaluateAgainstRun({
        interview,
        recalSession,
        transcriptText: buildRoleTaggedTranscript(confirmedTurns),
        preferredRunId: body.aiRunId,
        speakersConfirmed: true,
      });

      const updatedSession = await db.updateRecalibrateSession(id, {
        aiRunId: runId,
        transcriptTurns: confirmedTurns,
        speakerMap,
        speakersConfirmedAt: new Date(),
        aiEvaluation: evaluation,
      });

      await db.addAuditLog(session.user.email, 'IN_PERSON_SPEAKERS_CONFIRMED', 'Interview', id, {
        speakers: labels.length,
        candidateLabels: labels.filter((l) => speakerMap[l].role === 'candidate'),
        hasEvaluation: Boolean(evaluation),
      });

      return NextResponse.json({ success: true, session: updatedSession, evaluation, evaluationError });
    }

    // 1. AUDIO TRANSCRIPTION (from live recording or uploaded audio file)
    if (isAudio) {
      const audios: Array<{ audioBase64: string; mimeType: string }> = Array.isArray(body.audios) && body.audios.length > 0
        ? body.audios
        : (body.audioBase64 ? [{ audioBase64: body.audioBase64, mimeType: body.mimeType || 'audio/webm' }] : []);

      if (audios.length === 0) {
        return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
      }

      // Format components for S3 key naming: candidatename-round-startingtimestamp-duration
      const candidateSlug = (interview.candidateName || 'Candidate')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');

      let roundVal = body.round;
      if (!roundVal && interview.role) {
        const roleLower = interview.role.toLowerCase();
        if (roleLower.includes('l2')) roundVal = 'L2';
        else if (roleLower.includes('l1')) roundVal = 'L1';
        else roundVal = 'Technical';
      }
      const roundSlug = String(roundVal || 'Round')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '');

      const formatTimestamp = (d: Date): string => {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
      };

      const formatDurationSlug = (rawDuration?: string | number, fallbackMinutes?: number): string => {
        if (rawDuration !== undefined && rawDuration !== null && String(rawDuration).trim().length > 0) {
          const s = String(rawDuration).trim();
          if (s.includes(':')) {
            const parts = s.split(':');
            if (parts.length === 2) {
              const m = parseInt(parts[0], 10) || 0;
              const sec = parseInt(parts[1], 10) || 0;
              return m > 0 ? `${m}m${sec}s` : `${sec}s`;
            } else if (parts.length === 3) {
              const h = parseInt(parts[0], 10) || 0;
              const m = parseInt(parts[1], 10) || 0;
              const sec = parseInt(parts[2], 10) || 0;
              return `${h}h${m}m${sec}s`;
            }
          }
          const cleaned = s.replace(/[^a-zA-Z0-9_-]/g, '');
          return cleaned.endsWith('s') || cleaned.endsWith('m') ? cleaned : `${cleaned}s`;
        }
        return fallbackMinutes ? `${fallbackMinutes}m` : '0s';
      };

      // Query existing audios for this interview to accurately continue the clip count
      const existingAudios = await db.getInterviewAudiosByInterviewId(id);
      const existingClipCount = existingAudios.length;

      // Upload audio clip(s) to S3 before sending to Gemini
      const uploadedS3Clips: (UploadAudioResult & { index: number; fileName: string; mimeType?: string; duration?: string })[] = [];
      for (let i = 0; i < audios.length; i++) {
        const audioItem: any = audios[i];
        try {
          const extension = audioItem.mimeType?.includes('mp3')
            ? 'mp3'
            : (audioItem.mimeType?.includes('wav') ? 'wav' : 'webm');

          const startTime = audioItem.startingTimestamp
            ? new Date(audioItem.startingTimestamp)
            : new Date();
          const startTimestampStr = isNaN(startTime.getTime())
            ? formatTimestamp(new Date())
            : formatTimestamp(startTime);

          const durationSlug = formatDurationSlug(audioItem.duration, interview.duration);
          const clipCount = existingClipCount + i + 1;

          // Target naming: candidatename-round-startingtimestamp-duration-clip<clipCount>.ext
          const fileName = `${candidateSlug}-${roundSlug}-${startTimestampStr}-${durationSlug}-clip${clipCount}.${extension}`;

          const s3Result = await uploadAudioBase64({
            interviewId: id,
            audioBase64: audioItem.audioBase64,
            mimeType: audioItem.mimeType,
            fileName,
          });
          uploadedS3Clips.push({
            ...s3Result,
            index: i,
            fileName,
            mimeType: audioItem.mimeType,
            duration: durationSlug,
          });
          console.log(`[S3] Uploaded audio clip ${i + 1}/${audios.length} to ${s3Result.location}`);
        } catch (s3Err) {
          console.error(`[S3] Warning: Failed to upload audio clip ${i + 1} to S3:`, s3Err);
        }
      }

      const recalSession = await db.getOrCreateRecalibrateSession(id);
      const isAppend = Boolean(body.append);
      const previousTranscript = isAppend ? (recalSession.transcriptText || '') : '';
      const inPerson = recalSession.interviewMode === 'IN_PERSON';

      let combinedTranscript = '';
      // Each clip's own text (not the combined interview), so a saved clip's transcript
      // matches its recording.
      const clipTranscripts: string[] = [];
      for (const audioItem of audios) {
        const transResult = await transcribeAudioWithAi({
          audioBase64: audioItem.audioBase64,
          mimeType: audioItem.mimeType,
          candidateName: interview.candidateName,
          roleTitle: interview.role,
          existingTranscriptText: combinedTranscript || (isAppend ? previousTranscript : null),
          inPerson: inPerson ? { expectedSpeakers: Math.max(2, interview.panels.length + 1) } : undefined,
        });

        const clipText = transResult.transcriptText && !isTranscriptEmptyOrNoSpeech(transResult.transcriptText)
          ? transResult.transcriptText.trim()
          : '';
        clipTranscripts.push(clipText);
        if (transResult.transcriptText && !isTranscriptEmptyOrNoSpeech(transResult.transcriptText)) {
          if (combinedTranscript) {
            combinedTranscript += '\n\n' + transResult.transcriptText.trim();
          } else {
            combinedTranscript = transResult.transcriptText.trim();
          }
        }
      }

      // Build transcript for this session (or append if explicitly requested)
      const fullTranscript = isAppend && previousTranscript
        ? (combinedTranscript ? `${previousTranscript}\n\n${combinedTranscript}` : previousTranscript)
        : combinedTranscript;

      const turns = parseDialogueTurns(fullTranscript);

      // Store audio records in database and link the primary audio ID to the recalibrate session
      let primaryAudioId: string | null = null;
      for (const clip of uploadedS3Clips) {
        try {
          const audioRecord = await db.createInterviewAudio({
            interviewId: id,
            s3Key: clip.key,
            s3Url: clip.location,
            fileName: clip.fileName,
            mimeType: clip.mimeType || null,
            duration: clip.duration || null,
            transcriptText: clipTranscripts[clip.index] || null,
            transcriptTurns: clipTranscripts[clip.index] ? parseDialogueTurns(clipTranscripts[clip.index]) : null,
          });
          if (!primaryAudioId) {
            primaryAudioId = audioRecord.id;
          }
        } catch (audioDbErr) {
          console.error('[DB] Failed to save interview audio record:', audioDbErr);
        }
      }

      if (inPerson) {
        const run = await resolveQuestionRun(id, recalSession, body.aiRunId);
        const updatedSession = await prepareSpeakerReview({
          interview,
          recalSession,
          transcriptText: fullTranscript,
          keepPreviousMapping: isAppend,
          extra: {
            aiRunId: run?.id || recalSession.aiRunId || null,
            transcriptSource: body.sourceType || (body.audios ? 'live_recording' : 'audio_upload'),
          },
        });
        await db.addAuditLog(session.user.email, 'AUDIO_TRANSCRIBED', 'Interview', id, {
          chunksCount: audios.length,
          characters: fullTranscript.length,
          inPerson: true,
          s3AudioKeys: uploadedS3Clips.map((c) => c.key),
          audioId: primaryAudioId,
        });
        return NextResponse.json({
          success: true,
          session: updatedSession,
          audioId: primaryAudioId,
          evaluation: null,
          needsSpeakerConfirmation: true,
          s3AudioClips: uploadedS3Clips,
        });
      }

      // Evaluate against the question set (a failure is reported, never silent).
      const { evaluation, evaluationError, runId } = await evaluateAgainstRun({
        interview,
        recalSession,
        transcriptText: fullTranscript,
        preferredRunId: body.aiRunId,
        fallbackQuestions: body.questionSet,
        fallbackSpec: body.spec,
      });

      // Use the newly computed evaluation directly (do not retain obsolete scores from previous takes)
      const finalEvaluation = evaluation || null;

      const sourceType = body.sourceType || (body.audios ? 'live_recording' : 'audio_upload');
      const updatedSession = await db.updateRecalibrateSession(id, {
        aiRunId: runId,
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
        s3AudioKeys: uploadedS3Clips.map((c) => c.key),
        audioId: primaryAudioId,
      });

      return NextResponse.json({
        success: true,
        session: updatedSession,
        audioId: primaryAudioId,
        evaluation: finalEvaluation,
        evaluationError,
        s3AudioClips: uploadedS3Clips,
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

      if (recalSession.interviewMode === 'IN_PERSON') {
        const updatedSession = await prepareSpeakerReview({
          interview,
          recalSession,
          transcriptText: rawText,
          keepPreviousMapping: false,
          extra: { transcriptSource: 'manual_upload' },
        });
        return NextResponse.json({ success: true, session: updatedSession, evaluation: null, needsSpeakerConfirmation: true });
      }

      const { evaluation, evaluationError, runId } = await evaluateAgainstRun({
        interview,
        recalSession,
        transcriptText: rawText,
        preferredRunId: body.aiRunId,
        fallbackQuestions: body.questionSet,
        fallbackSpec: body.spec,
      });

      const updatedSession = await db.updateRecalibrateSession(id, {
        aiRunId: runId,
        transcriptText: rawText,
        transcriptTurns: turns.length > 0 ? turns : null,
        aiEvaluation: evaluation,
        transcriptFetchedAt: new Date(),
        transcriptSource: 'manual_upload',
      });

      return NextResponse.json({
        success: true,
        session: updatedSession,
        evaluation,
        evaluationError,
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

      const recalSession = await db.getOrCreateRecalibrateSession(id);
      const { evaluation, evaluationError, runId } = await evaluateAgainstRun({
        interview,
        recalSession,
        transcriptText: combinedVtt,
        preferredRunId: body.aiRunId,
        fallbackQuestions: body.questionSet,
        fallbackSpec: body.spec,
      });

      // Teams VTT carries the real speaker per cue — turn it into proper dialogue turns
      // (the plain-text parser mangles VTT cue timings into fake "speakers").
      const turns: TranscriptDialogueTurn[] = combinedVtt
        ? attributeSpeakers(parseVtt(combinedVtt), {
            candidateName: interview.candidateName,
            candidateEmail: interview.candidateEmail,
            panelistNames: interview.panels.map((p) => p.name),
          })
            .filter((seg) => seg.text.trim())
            .map((seg) => ({
              speaker: seg.speaker || 'Unknown',
              timestamp: formatTimestamp(seg.startMs),
              text: seg.text.trim(),
              ...(seg.role !== 'unknown' ? { role: seg.role } : {}),
            }))
        : [];
      const updatedSession = await db.updateRecalibrateSession(id, {
        aiRunId: runId,
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
        hasTranscript: Boolean(combinedVtt),
        session: updatedSession,
        evaluation,
        evaluationError,
      });
    }

    // Fallback: If source was not recognized, return explicit error instead of triggering Graph sync
    return NextResponse.json(
      { error: 'Missing or unsupported transcript source. Supported sources: "audio", "text", "graph", "speakers" or "evaluate".' },
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
