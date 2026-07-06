import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// POST /api/candidates/[id]/unmap — revert a MAPPED candidate back to WAITING
// and release its interview slot back to "Pending Assignment".
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing candidate ID' }, { status: 400 });
    }

    const unmapped = await db.unmapCandidate(id);
    if (!unmapped) {
      return NextResponse.json({ error: 'Candidate is not currently mapped to an interview.' }, { status: 400 });
    }

    const [candidates, interviews] = await Promise.all([
      db.getUploadedCandidates(),
      db.getInterviews(),
    ]);

    return NextResponse.json({ success: true, candidates, interviews });
  } catch (error) {
    console.error('Failed to unmap candidate:', error);
    return NextResponse.json({ error: 'Failed to unmap candidate' }, { status: 500 });
  }
}
