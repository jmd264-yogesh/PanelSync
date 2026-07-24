import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { lateralCandidatesService } from '@server/services/lateral-candidates/lateral-candidates.service';

export const dynamic = 'force-dynamic';

// PATCH edit a lateral candidate / advance their pipeline status
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
    const body = await request.json();

    const candidates = await lateralCandidatesService.updateLateralCandidate(id, body);
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error('Failed to update lateral candidate:', error);
    const message = error instanceof Error ? error.message : 'Failed to update lateral candidate';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE (soft) a lateral candidate
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
    const candidates = await lateralCandidatesService.deleteLateralCandidate(id);
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error('Failed to delete lateral candidate:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete lateral candidate';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
