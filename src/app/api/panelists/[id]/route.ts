import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@server/lib/session';
import { panelistsService } from '@server/services/panelists/panelists.service';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await panelistsService.removePanelist(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to remove panelist:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove panelist';
    const status = message === 'Panelist not found' ? 404 : message === 'ID is required' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
