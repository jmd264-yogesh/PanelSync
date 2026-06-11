import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  await clearSession();
  const response = NextResponse.redirect(new URL('/', request.url));
  return response;
}
