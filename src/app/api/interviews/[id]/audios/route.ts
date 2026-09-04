import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPanelistSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const assigned = await db.isPanelistAssignedToInterview(session.user.email, id);
    if (!assigned) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const audios = await db.getInterviewAudiosByInterviewId(id);

    return NextResponse.json({
      audios: audios.map((a) => ({
        id: a.id,
        interviewId: a.interviewId,
        fileName: a.fileName,
        duration: a.duration,
        mimeType: a.mimeType,
        s3Key: a.s3Key,
        s3Url: a.s3Url,
        streamUrl: `/api/interviews/${id}/audios/${a.id}/stream`,
        transcriptText: a.transcriptText,
        createdAt: a.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('[Audios GET Error]:', error);
    return NextResponse.json({ error: 'Failed to fetch interview audios' }, { status: 500 });
  }
}
