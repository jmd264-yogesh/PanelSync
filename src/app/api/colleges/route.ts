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
    const colleges = await db.getColleges();
    return NextResponse.json(colleges);
  } catch (error) {
    console.error('Failed to load colleges:', error);
    return NextResponse.json({ error: 'Failed to load colleges' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'College name is required' }, { status: 400 });
    }

    try {
      await db.addCollege(name);
      return NextResponse.json({ success: true, name: name.trim() });
    } catch (dbErr: any) {
      return NextResponse.json({ error: dbErr.message || 'Database error adding college' }, { status: 400 });
    }
  } catch (error) {
    console.error('Failed to add college:', error);
    return NextResponse.json({ error: 'Failed to add college' }, { status: 500 });
  }
}
