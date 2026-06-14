import { NextRequest, NextResponse } from 'next/server';
import { getPanelistSession } from '@/lib/session';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ panelId: string }> }
) {
  const session = await getPanelistSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { panelId } = await params;
  const body = await request.json();
  const { feedback, decision } = body as { feedback?: string; decision?: string };

  if (!decision || !['PASSED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'decision must be PASSED or REJECTED' }, { status: 400 });
  }

  await db.submitPanelFeedback(panelId, feedback || '', decision as 'PASSED' | 'REJECTED');
  return NextResponse.json({ success: true });
}
