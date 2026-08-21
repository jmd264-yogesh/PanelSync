import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';
import {
  TranscriptError,
  fetchTranscriptVtt,
  listTranscripts,
  resolveOnlineMeetingId,
} from '@/lib/graph-transcript';
import { analyseTranscript } from '@/lib/transcript';

export const dynamic = 'force-dynamic';

// Pulling a 45-minute transcript out of Graph and back is not a fast request.
export const maxDuration = 60;

/** Shared auth + identity resolution for both verbs. */
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

// GET — whatever transcript we have already stored. Never calls Graph, so it's cheap
// enough to load alongside the rest of the Recalibrate workspace.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPanelistSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const ctx = await loadContext(id, session.user.email);
    if (ctx.error) return ctx.error;

    const stored = await db.getInterviewTranscripts(id);
    const combinedVtt = stored.map((t) => t.contentVtt ?? '').filter(Boolean).join('\n\n');

    return NextResponse.json({
      hasTranscript: combinedVtt.length > 0,
      fetchedAt: stored[0]?.fetchedAt ?? null,
      transcriptCount: stored.length,
      analysis: combinedVtt ? analysisFor(ctx.interview, combinedVtt) : null,
    });
  } catch (error) {
    console.error('Failed to read stored transcript:', error);
    return NextResponse.json({ error: 'Failed to read transcript' }, { status: 500 });
  }
}

// POST — sync from Graph, then store. Separate from GET on purpose: this one costs a
// round trip to Microsoft and should only happen when someone asks for it.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPanelistSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    const ctx = await loadContext(id, session.user.email);
    if (ctx.error) return ctx.error;
    const interview = ctx.interview;

    const identity = await db.getInterviewMeetingIdentity(id);
    if (!identity?.organizerUserId) {
      throw new TranscriptError(
        'NO_ORGANIZER',
        'This interview has no recorded meeting organizer, so its transcript cannot be located. Interviews scheduled before transcript support was added are affected — reschedule to enable it.',
        409,
      );
    }
    if (!identity.teamsMeetingUrl) {
      throw new TranscriptError('MEETING_NOT_FOUND', 'This interview has no Teams meeting attached.', 409);
    }

    // Resolve once and cache — the lookup is the slowest part of the sync.
    let onlineMeetingId = identity.onlineMeetingId;
    if (!onlineMeetingId) {
      onlineMeetingId = await resolveOnlineMeetingId(identity.organizerUserId, identity.teamsMeetingUrl);
      await db.setInterviewOnlineMeetingId(id, onlineMeetingId);
    }

    const available = await listTranscripts(identity.organizerUserId, onlineMeetingId);
    if (available.length === 0) {
      throw new TranscriptError(
        'NO_TRANSCRIPT',
        'Teams has no transcript for this meeting. Transcription has to be started during the call — it is not on by default. Ask the panelist to use "Start transcription" in the Teams meeting, or have an admin enable it by policy.',
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

    await db.addAuditLog(session.user.email, 'TRANSCRIPT_SYNCED', 'Interview', id, {
      transcriptCount: stored.length,
      characters: combinedVtt.length,
    });

    return NextResponse.json({
      hasTranscript: combinedVtt.length > 0,
      fetchedAt: stored[0]?.fetchedAt ?? null,
      transcriptCount: stored.length,
      analysis: combinedVtt ? analysisFor(interview, combinedVtt) : null,
    });
  } catch (error) {
    if (error instanceof TranscriptError) {
      // The message is written to be actionable — which permission is missing, or that
      // nobody started transcription — so surface it verbatim rather than flattening it.
      console.error(`Transcript sync failed for ${id} [${error.code}]:`, error.message);
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Transcript sync failed:', error);
    return NextResponse.json({ error: 'Failed to sync the transcript.' }, { status: 500 });
  }
}
