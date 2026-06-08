import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'AZURE_CLIENT_ID is not configured' }, { status: 500 });
  }

  // Required Graph scopes for logging in, directory searching, chat sending, and scheduling events
  const scopes = [
    'openid',
    'profile',
    'offline_access',
    'User.Read',
    'User.Read.All',
    'Chat.Create',
    'ChatMessage.Send',
    'Calendars.ReadWrite',
  ].join(' ');

  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${encodeURIComponent(scopes)}&state=mcp-auth`;

  return NextResponse.redirect(authUrl);
}
