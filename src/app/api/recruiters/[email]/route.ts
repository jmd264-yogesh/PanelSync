import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email } = await params;
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const decodedEmail = decodeURIComponent(email);
    const success = await db.removeAllowedRecruiter(decodedEmail);
    if (!success) {
      return NextResponse.json({ error: 'Failed to remove recruiter' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to remove allowed recruiter:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove recruiter' }, { status: 500 });
  }
}
