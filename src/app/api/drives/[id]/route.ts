import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { drivesService } from '@server/services/drives/drives.service';

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
    const result = await drivesService.deleteDrive(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to delete drive:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete drive';
    return NextResponse.json({ error: message }, { status: 400 });
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
    const body = await request.json();
    const { status } = body;

    const result = await drivesService.updateDriveStatus(id, status);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to update drive status:', error);
    const message = error instanceof Error ? error.message : 'Failed to update drive status';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
