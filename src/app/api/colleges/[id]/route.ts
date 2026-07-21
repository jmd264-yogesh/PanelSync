import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@server/lib/session';
import { collegesService } from '@server/services/colleges/colleges.service';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await collegesService.deleteCollege(id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Failed to delete college:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete college';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
