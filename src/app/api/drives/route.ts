import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const drives = await db.getDrives();
    const activeDrive = await db.getActiveDrive();
    return NextResponse.json({ drives, activeDrive });
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
    const { collegeName, driveDate } = body;

    if (!collegeName || typeof collegeName !== 'string' || !collegeName.trim()) {
      return NextResponse.json({ error: 'College name is required' }, { status: 400 });
    }
    if (!driveDate || typeof driveDate !== 'string' || !driveDate.trim()) {
      return NextResponse.json({ error: 'Drive date is required' }, { status: 400 });
    }

    const newDrive = await db.createDrive(collegeName, driveDate);
    return NextResponse.json({ success: true, drive: newDrive });
  } catch (error) {
    console.error('Failed to create drive:', error);
    return NextResponse.json({ error: 'Failed to create drive' }, { status: 500 });
  }
}
