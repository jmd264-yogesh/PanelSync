import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { recruitersService } from '@server/services/recruiters/recruiters.service';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recruiters = await recruitersService.getRecruiters();
    return NextResponse.json(recruiters);
  } catch (error) {
    console.error('Failed to load allowed recruiters:', error);
    return NextResponse.json({ error: 'Failed to load allowed recruiters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email } = body;

    const result = await recruitersService.addRecruiter(email, session.user.email);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to add allowed recruiter:', error);
    const message = error instanceof Error ? error.message : 'Failed to add allowed recruiter';
    const status = message.includes('required') || message.includes('already') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
