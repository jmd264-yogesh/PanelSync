import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Drive ID is required' }, { status: 400 });
    }

    await db.setActiveDrive(id);
    const updatedActiveDrive = await db.getActiveDrive();
    return NextResponse.json({ success: true, activeDrive: updatedActiveDrive });
  } catch (error) {
    console.error('Failed to set active drive:', error);
    return NextResponse.json({ error: 'Failed to set active drive' }, { status: 500 });
  }
}
