import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.delete('session');
  return response;
}
