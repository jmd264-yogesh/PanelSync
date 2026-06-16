import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/lib/db';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, reason } = body;

    if (!token || !reason || !reason.trim()) {
      return NextResponse.json({ error: 'Missing token or rejection reason' }, { status: 400 });
    }

    // 1. Find the panel request by token
    const [panelRow] = await dbClient
      .select()
      .from(schema.interviewPanels)
      .where(eq(schema.interviewPanels.token, token))
      .limit(1);

    if (!panelRow) {
      return NextResponse.json({ error: 'Interview panel request not found' }, { status: 404 });
    }

    // 2. Clear out any previously submitted slots for this panelist
    await dbClient
      .delete(schema.panelAvailabilities)
      .where(eq(schema.panelAvailabilities.panelId, panelRow.id));

    // 3. Set status to REJECTED and save the reason in feedback
    const now = new Date();
    await dbClient
      .update(schema.interviewPanels)
      .set({
        status: 'REJECTED',
        submittedAt: now,
        feedback: reason.trim(),
      })
      .where(eq(schema.interviewPanels.id, panelRow.id));

    // 4. Touch the parent interview's updatedAt field
    await dbClient
      .update(schema.interviews)
      .set({ updatedAt: now })
      .where(eq(schema.interviews.id, panelRow.interviewId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to reject panel request:', error);
    return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 });
  }
}
