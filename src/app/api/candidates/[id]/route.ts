import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { candidatesService } from '@server/services/candidates/candidates.service';

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

    const candidates = await candidatesService.deleteCandidate(id);
    return NextResponse.json({ success: true, candidates });
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
    const candidates = await candidatesService.updateCandidate(id, body);
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error('Failed to update candidate:', error);
    const message = error instanceof Error ? error.message : 'Failed to update candidate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
