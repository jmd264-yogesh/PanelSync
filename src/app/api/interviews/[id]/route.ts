import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/session';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const success = await db.deleteInterview(id);
  if (!success) {
    return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { startDate, endDate, slots } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Missing start or end date' }, { status: 400 });
    }

    const { dbClient } = await import('@/lib/db');
    const schema = await import('@/lib/schema');
    const { eq } = await import('drizzle-orm');

    // 1. Update interview dates and reset any scheduled booking info
    const now = new Date();
    await dbClient
      .update(schema.interviews)
      .set({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'PENDING',
        scheduledSlotStart: null,
        scheduledSlotEnd: null,
        teamsMeetingUrl: null,
        calendarEventId: null,
        updatedAt: now,
      })
      .where(eq(schema.interviews.id, id));

    // 2. Fetch panels for this interview
    const panels = await dbClient
      .select()
      .from(schema.interviewPanels)
      .where(eq(schema.interviewPanels.interviewId, id));

    // 3. For each panel, reset status to PENDING, delete old availabilities, and insert new proposed slots
    for (const panel of panels) {
      await dbClient
        .update(schema.interviewPanels)
        .set({ status: 'PENDING', submittedAt: null })
        .where(eq(schema.interviewPanels.id, panel.id));

      await dbClient
        .delete(schema.panelAvailabilities)
        .where(eq(schema.panelAvailabilities.panelId, panel.id));

      if (slots && slots.length) {
        for (const slot of slots) {
          const avId = crypto.randomUUID();
          await dbClient.insert(schema.panelAvailabilities).values({
            id: avId,
            panelId: panel.id,
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
          });
        }
      }
    }

    const updated = await db.getInterview(id);
    return NextResponse.json({ success: true, interview: updated });
  } catch (error) {
    console.error('Failed to update interview dates:', error);
    return NextResponse.json({ error: 'Failed to update interview dates' }, { status: 500 });
  }
}
