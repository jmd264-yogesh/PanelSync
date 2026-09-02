import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  await clearSession();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const response = NextResponse.redirect(new URL('/', baseUrl));
  return response;
}
