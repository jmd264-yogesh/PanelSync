import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, slots } = body;

    if (!token || !slots || !Array.isArray(slots)) {
      return NextResponse.json({ error: 'Missing token or invalid slots' }, { status: 400 });
    }

    const now = Date.now();
    const hasPastSlot = slots.some((s: any) => new Date(s.startTime).getTime() < now);
    if (hasPastSlot) {
      return NextResponse.json({ error: 'Cannot submit availability slots in the past.' }, { status: 400 });
    }

    const success = await db.submitAvailability(token, slots);
    if (!success) {
      return NextResponse.json({ error: 'Invalid token or panel not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to submit availability:', error);
    return NextResponse.json({ error: 'Failed to submit availability' }, { status: 500 });
  }
}
