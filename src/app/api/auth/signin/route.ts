import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'AZURE_CLIENT_ID is not configured' }, { status: 500 });
  }

  const role = new URL(request.url).searchParams.get('role') || 'recruiter';

  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'User.Read',
    'User.Read.All',
    'Chat.Create',
    'ChatMessage.Send',
    'Calendars.ReadWrite',
    // Files.Read intentionally omitted: requesting it before the Azure AD app
    // registration has that permission admin-consented blocks login entirely
    // with a "Need admin approval" screen. Re-add once that's confirmed granted.
  ].join(' ');

  const state = `panelsync-auth|role=${role}`;
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

  return NextResponse.redirect(authUrl);
}
