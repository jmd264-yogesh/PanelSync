import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { lateralCandidatesService } from '@server/services/lateral-candidates/lateral-candidates.service';

export const dynamic = 'force-dynamic';

// Recruiter-facing read of a lateral candidate's Recalibrate assessment. Only ever
// exposes a session the panelist has explicitly submitted — draft/in-progress scoring
// stays panelist-only.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const report = await lateralCandidatesService.getRecalibrateReport(id);
    return NextResponse.json(report);
  } catch (error) {
    console.error('Failed to fetch recalibrate report:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch recalibrate report';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
