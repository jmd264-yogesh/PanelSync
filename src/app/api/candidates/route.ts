import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, getSession } from '@server/lib/session';
import { candidatesService } from '@server/services/candidates/candidates.service';

export const dynamic = 'force-dynamic';

// GET candidates queue
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const list = await candidatesService.getCandidates();
    return NextResponse.json(list);
  } catch (error) {
    console.error('Failed to fetch candidates:', error);
    return NextResponse.json({ error: 'Failed to fetch candidates' }, { status: 500 });
  }
}

// POST bulk upload candidates
export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { candidates } = body;

    const result = await candidatesService.bulkUploadCandidates(
      candidates,
      token,
      session.user.email
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Failed to upload candidates:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload candidates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
