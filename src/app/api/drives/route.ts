import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { drivesService } from '@server/services/drives/drives.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await drivesService.getDrivesWithActive();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to load drives:', error);
    return NextResponse.json({ error: 'Failed to load drives' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { collegeName, startDate, endDate } = body;

    const result = await drivesService.createDrive(collegeName, startDate, endDate);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to create drive:', error);
    const message = error instanceof Error ? error.message : 'Failed to create drive';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
