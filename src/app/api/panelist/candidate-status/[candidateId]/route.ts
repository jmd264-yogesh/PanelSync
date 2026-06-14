import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';

const ALLOWED_BY_ROLE: Record<string, string[]> = {
  L1: ['PASSED_L1', 'REJECTED'],
  L2: ['PASSED_L2', 'REJECTED'],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const session = await getPanelistSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { candidateId } = await params;
  const body = await request.json();
  const { outcomeStatus } = body as { outcomeStatus?: string };

  if (!outcomeStatus) {
    return NextResponse.json({ error: 'outcomeStatus is required' }, { status: 400 });
  }

  // SELECTED is never settable by panelists
  if (outcomeStatus === 'SELECTED') {
    return NextResponse.json({ error: 'Only recruiters can mark a candidate as SELECTED' }, { status: 403 });
  }

  const panelistRecord = await db.getPanelistByEmail(session.user.email);
  if (!panelistRecord) {
    return NextResponse.json({ error: 'Panelist record not found' }, { status: 403 });
  }

  const roles: string[] = panelistRecord.roles ?? [];
  const permittedStatuses = roles.flatMap((role) => ALLOWED_BY_ROLE[role] ?? []);

  if (!permittedStatuses.includes(outcomeStatus)) {
    return NextResponse.json(
      { error: `Your role(s) do not permit setting status to ${outcomeStatus}` },
      { status: 403 }
    );
  }

  await db.updateCandidateOutcome(candidateId, outcomeStatus);
  return NextResponse.json({ success: true });
}
