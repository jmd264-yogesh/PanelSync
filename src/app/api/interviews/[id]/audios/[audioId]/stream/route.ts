import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';
import { s3Client } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { normalizeAudioMime } from '@/lib/audio-mime';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; audioId: string }> }
) {
  const session = await getPanelistSession();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });

  try {
    const { id, audioId } = await params;
    const assigned = await db.isPanelistAssignedToInterview(session.user.email, id);
    if (!assigned) return new NextResponse('Unauthorized', { status: 401 });

    const audio = await db.getInterviewAudio(audioId);
    if (!audio || audio.interviewId !== id) {
      return new NextResponse('Audio recording not found', { status: 404 });
    }

    const bucketName = process.env.AWS_S3_BUCKET_NAME?.trim() || 'panel-sync-audio';
    // Forward Range so the browser's player can seek (and Safari can play at all).
    const range = request.headers.get('range') || undefined;
    const s3Response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: audio.s3Key,
        Range: range,
      })
    );

    if (!s3Response.Body) {
      return new NextResponse('Empty audio body', { status: 404 });
    }

    // Never trust the stored type: anything that is not real audio is sent as a download,
    // so an upload can't be rendered as a page on this origin.
    const safeType = normalizeAudioMime(audio.mimeType);
    const stream = s3Response.Body.transformToWebStream();
    const headers = new Headers();
    headers.set('Content-Type', safeType ?? 'application/octet-stream');
    headers.set('Content-Disposition', safeType ? 'inline' : 'attachment');
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Accept-Ranges', 'bytes');
    if (s3Response.ContentLength !== undefined) {
      headers.set('Content-Length', String(s3Response.ContentLength));
    }
    if (s3Response.ContentRange) {
      headers.set('Content-Range', s3Response.ContentRange);
    }
    // Interview audio is private to the assigned panelists — keep it out of shared caches.
    headers.set('Cache-Control', 'private, no-store');

    return new NextResponse(stream as ReadableStream, {
      status: s3Response.ContentRange ? 206 : 200,
      headers,
    });
  } catch (error) {
    console.error('[Audio Stream Error]:', error);
    return new NextResponse('Failed to stream audio file', { status: 500 });
  }
}
