import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@server/lib/session';
import { db } from '@server/lib/db';
import { blob } from '@server/lib/blob';

export const dynamic = 'force-dynamic';

// Streams the candidate's resume back to an assigned panelist. The blob URL is
// never sent to the client — this route is the only thing that ever fetches it,
// so file access is gated entirely by the panelist's own session/assignment.
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
    if (!id) {
      return NextResponse.json({ error: 'Missing interview ID' }, { status: 400 });
    }

    const assigned = await db.isPanelistAssignedToInterview(session.user.email, id);
    if (!assigned) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check the campus pipeline first, then the lateral hiring pipeline — an
    // interview belongs to exactly one of the two.
    const candidate = await db.getCandidateForInterview(id) || await db.getLateralCandidateForInterview(id);
    if (!candidate || !candidate.resumeFileKey) {
      return NextResponse.json({ error: 'No resume on file for this interview.' }, { status: 404 });
    }

    const { buffer, contentType } = await blob.fetchResume(candidate.resumeFileKey);
    await db.addAuditLog(session.user.email, 'RESUME_VIEWED', 'Interview', id, { candidateId: candidate.id });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('Failed to fetch resume:', error);
    return NextResponse.json({ error: 'Failed to fetch resume' }, { status: 500 });
  }
}
