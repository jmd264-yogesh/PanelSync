import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/session';
import { db } from '@/lib/db';

export async function GET() {
  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const panelists = await db.getPanelists();
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

    if (!user || !user.id || !user.displayName || !user.email || !roles || !Array.isArray(roles)) {
      return NextResponse.json({ error: 'Missing user profile or roles' }, { status: 400 });
    }

    // Add or update panelist in local JSON store
    const panelist = await db.addPanelist(user, roles);
    return NextResponse.json(panelist);
  } catch (error) {
    console.error('Failed to save panelist:', error);
    return NextResponse.json({ error: 'Failed to save panelist' }, { status: 500 });
  }
}
