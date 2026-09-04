import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';
import { s3Client } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';

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
    const s3Response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: audio.s3Key,
      })
    );

    if (!s3Response.Body) {
      return new NextResponse('Empty audio body', { status: 404 });
    }

    const stream = s3Response.Body.transformToWebStream();
    const headers = new Headers();
    headers.set('Content-Type', audio.mimeType || 'audio/webm');
    headers.set('Accept-Ranges', 'bytes');
    if (s3Response.ContentLength) {
      headers.set('Content-Length', String(s3Response.ContentLength));
    }
    headers.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(stream as ReadableStream, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('[Audio Stream Error]:', error);
    return new NextResponse('Failed to stream audio file', { status: 500 });
  }
}
