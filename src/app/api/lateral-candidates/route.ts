import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { lateralCandidatesService } from '@server/services/lateral-candidates/lateral-candidates.service';

export const dynamic = 'force-dynamic';

// GET lateral hiring queue
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const list = await lateralCandidatesService.getLateralCandidates();
    return NextResponse.json(list);
  } catch (error) {
    console.error('Failed to fetch lateral candidates:', error);
    return NextResponse.json({ error: 'Failed to fetch lateral candidates' }, { status: 500 });
  }
}

// POST add a lateral candidate
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const candidates = await lateralCandidatesService.addLateralCandidate(body);
    return NextResponse.json({ success: true, candidates });
  } catch (error) {
    console.error('Failed to add lateral candidate:', error);
    const message = error instanceof Error ? error.message : 'Failed to add lateral candidate';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
