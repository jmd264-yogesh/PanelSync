import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const stateParam = searchParams.get('state') || '';
  const isPanelistLogin = stateParam.includes('role=panelist');

  if (error) {
    console.error('OAuth Callback Error:', error, errorDescription);
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(errorDescription || error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/?error=no_code_provided', request.url));
  }

  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!clientId || !clientSecret) {
    console.error('Azure client configuration missing.');
    return NextResponse.redirect(new URL('/?error=server_configuration_error', request.url));
  }

  try {
    // 1. Exchange authorization code for access and refresh tokens
    const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        scope: 'openid profile offline_access User.Read User.Read.All Chat.Create ChatMessage.Send Calendars.ReadWrite',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Token exchange failed:', errText);
      return NextResponse.redirect(new URL('/?error=token_exchange_failed', request.url));
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = Date.now() + tokenData.expires_in * 1000;

    // 2. Query Microsoft Graph to retrieve authenticated user details
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errText = await userResponse.text();
      console.error('Graph user profile request failed:', errText);
      return NextResponse.redirect(new URL('/?error=user_profile_failed', request.url));
    }

    const userData = await userResponse.json();
    const userEmail = (userData.mail || userData.userPrincipalName || '').toLowerCase().trim();

    // 3. Verify role-based access
    const { db } = await import('@/lib/db');

    if (isPanelistLogin) {
      const isPanelist = await db.isPanelist(userEmail);
      if (!isPanelist) {
        console.warn(`Panelist sign-in attempt by unregistered email: ${userEmail}`);
        return NextResponse.redirect(new URL('/?error=not_a_panelist', request.url));
      }
    } else {
      const isAllowed = await db.isEmailAllowed(userEmail);
      if (!isAllowed) {
        console.warn(`Unauthorized recruiter sign-in attempt by email: ${userEmail}`);
        return NextResponse.redirect(new URL('/?error=unauthorized_recruiter', request.url));
      }
    }

    // 4. Save session to server store and get sessionId
    const sessionId = await setSession({
      accessToken,
      refreshToken,
      expiresAt,
      user: {
        id: userData.id,
        displayName: userData.displayName,
        email: userEmail,
      },
    });

    const redirectPath = isPanelistLogin ? '/panelist' : '/dashboard';
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.set('sessionId', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('Callback handler network or parsing error:', err);
    return NextResponse.redirect(new URL('/?error=internal_server_error', request.url));
  }
}
