import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { drivesService } from '@server/services/drives/drives.service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id } = body;

    const result = await drivesService.setActiveDrive(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to set active drive:', error);
    const message = error instanceof Error ? error.message : 'Failed to set active drive';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
