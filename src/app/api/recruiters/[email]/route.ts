import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { recruitersService } from '@server/services/recruiters/recruiters.service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email } = await params;
    const result = await recruitersService.removeRecruiter(email);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to remove allowed recruiter:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove recruiter';
    const status = message.includes('required') || message.includes('Failed to remove') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
