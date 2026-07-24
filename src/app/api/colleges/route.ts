import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { collegesService } from '@server/services/colleges/colleges.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const colleges = await collegesService.getColleges();
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

    const result = await collegesService.addCollege(name);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to add college:', error);
    const message = error instanceof Error ? error.message : 'Failed to add college';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
