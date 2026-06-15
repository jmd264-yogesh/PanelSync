import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE candidate by ID
export async function DELETE(
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

    await db.deleteUploadedCandidate(id);
    const updatedList = await db.getUploadedCandidates();

    return NextResponse.json({ success: true, candidates: updatedList });
  } catch (error) {
    console.error('Failed to delete candidate:', error);
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }
}

// PATCH candidate preferred date
export async function PATCH(
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

    const body = await request.json();

    if ('outcomeStatus' in body) {
      await db.updateCandidateOutcome(id, body.outcomeStatus);
      const updatedList = await db.getUploadedCandidates();
      return NextResponse.json({ success: true, candidates: updatedList });
    }

    const { preferredDate } = body;
    if (!preferredDate || !preferredDate.trim()) {
      return NextResponse.json({ error: 'Drive Date is required.' }, { status: 400 });
    }
    await db.updateCandidateDate(id, preferredDate);

    const updatedList = await db.getUploadedCandidates();
    return NextResponse.json({ success: true, candidates: updatedList });
  } catch (error) {
    console.error('Failed to update candidate preferred date:', error);
    return NextResponse.json({ error: 'Failed to update candidate preferred date' }, { status: 500 });
  }
}
