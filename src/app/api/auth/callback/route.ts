import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@server/services/auth/auth.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const stateParam = searchParams.get('state') || '';

  // Parse role from OAuth state
  const role = authService.parseRoleFromState(stateParam);

  // Handle OAuth errors
  if (error) {
    console.error('OAuth Callback Error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code_provided', request.url));
  }

  // Validate environment configuration
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    console.error('Azure client configuration missing.');
    return NextResponse.redirect(new URL('/?error=server_configuration_error', request.url));
  }

  const config = { clientId, clientSecret, tenantId, redirectUri };

  try {
    // Exchange authorization code for tokens
    const tokenData = await authService.exchangeCodeForTokens(code, config);

    // Fetch user profile from Microsoft Graph
    const userProfile = await authService.fetchUserProfile(tokenData.access_token);

    // Extract user email
    const userEmail = authService.extractEmail(userProfile);

    // Verify role-based access
    const accessCheck = await authService.verifyRoleAccess(userEmail, role);
    if (!accessCheck.allowed) {
      return NextResponse.redirect(
        new URL(`/?error=${accessCheck.reason?.toLowerCase()}`, request.url)
      );
    }

    // Create session
    const session = await authService.createSession(tokenData, userProfile, role);

    // Set session cookie and redirect
    const response = NextResponse.redirect(new URL(session.redirectPath, request.url));
    response.cookies.set('sessionId', session.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err: any) {
    console.error('Callback handler error:', err);
    const errorCode = err.message === 'TOKEN_EXCHANGE_FAILED'
      ? 'token_exchange_failed'
      : err.message === 'USER_PROFILE_FAILED'
      ? 'user_profile_failed'
      : 'internal_server_error';
    return NextResponse.redirect(new URL(`/?error=${errorCode}`, request.url));
  }
}
