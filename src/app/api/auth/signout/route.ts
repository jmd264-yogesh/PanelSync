import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@server/services/auth/auth.service';

export async function GET(request: NextRequest) {
  // Clear user session
  await authService.destroySession();

  // Redirect to home page
  const response = NextResponse.redirect(new URL('/', request.url));

  return response;
}
