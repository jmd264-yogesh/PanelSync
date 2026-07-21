import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@server/lib/session';
import { panelistsService } from '@server/services/panelists/panelists.service';

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const panelists = await panelistsService.getPanelists();
    return NextResponse.json(panelists);
  } catch (error) {
    console.error('Failed to load panelists:', error);
    return NextResponse.json({ error: 'Failed to load panelists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { user, roles } = body;

    const panelist = await panelistsService.addPanelist(user, roles);
    return NextResponse.json(panelist);
  } catch (error) {
    console.error('Failed to save panelist:', error);
    const message = error instanceof Error ? error.message : 'Failed to save panelist';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
