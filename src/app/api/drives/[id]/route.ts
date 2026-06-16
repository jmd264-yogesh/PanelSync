import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
    if (!id) {
      return NextResponse.json({ error: 'Missing drive ID' }, { status: 400 });
    }

    await db.deleteDrive(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete drive:', error);
    return NextResponse.json({ error: 'Failed to delete drive' }, { status: 500 });
  }
}

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
    if (!id) {
      return NextResponse.json({ error: 'Missing drive ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;
    if (status !== 'OPEN' && status !== 'CLOSED') {
      return NextResponse.json({ error: 'status must be OPEN or CLOSED' }, { status: 400 });
    }

    await db.setDriveStatus(id, status);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update drive status:', error);
    return NextResponse.json({ error: 'Failed to update drive status' }, { status: 500 });
  }
}
