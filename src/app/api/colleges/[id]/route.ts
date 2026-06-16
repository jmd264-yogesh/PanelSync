import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { db } from '@/lib/db';

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
    if (!id) {
      return NextResponse.json({ error: 'Missing college ID' }, { status: 400 });
    }

    await db.deleteCollege(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete college:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete college' }, { status: 400 });
  }
}
