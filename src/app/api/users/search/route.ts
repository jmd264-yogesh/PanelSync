import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@server/lib/session';
import { usersService } from '@server/services/users/users.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  const token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await usersService.searchUsers(query, token);
    return NextResponse.json(users);
  } catch (error) {
    console.error('Failed to search users:', error);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
