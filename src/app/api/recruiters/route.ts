import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const recruiters = await db.getAllowedRecruiters();
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

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const success = await db.addAllowedRecruiter(email, session.user.email);
    if (!success) {
      return NextResponse.json({ error: 'Recruiter already pre-approved or registered' }, { status: 400 });
    }

    return NextResponse.json({ success: true, email: email.trim().toLowerCase() });
  } catch (error) {
    console.error('Failed to add allowed recruiter:', error);
    return NextResponse.json({ error: 'Failed to add allowed recruiter' }, { status: 500 });
  }
}
