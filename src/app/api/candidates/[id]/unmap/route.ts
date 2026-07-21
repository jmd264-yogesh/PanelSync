import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { candidatesService } from '@server/services/candidates/candidates.service';

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

    const result = await candidatesService.unmapCandidate(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Failed to unmap candidate:', error);
    const message = error instanceof Error ? error.message : 'Failed to unmap candidate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
