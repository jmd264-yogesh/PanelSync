import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/session';
import { graph } from '@/lib/graph';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  if (query.trim().length < 2) {
    return NextResponse.json([]);
  }

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await graph.searchUsers(query, token);
    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to search users:', error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
