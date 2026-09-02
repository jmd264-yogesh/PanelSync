import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';
import { getAppUrl } from '@/lib/app-url';

export async function GET(request: NextRequest) {
  await clearSession();
  const baseUrl = getAppUrl(request);
  const response = NextResponse.redirect(new URL('/', baseUrl));
  return response;
}
