import { NextRequest, NextResponse } from 'next/server';
import { authService, type TUserRole } from '@server/services/auth/auth.service';

export async function GET(request: NextRequest) {
  // Validate environment configuration
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: 'AZURE_CLIENT_ID is not configured' },
      { status: 500 }
    );
  }

  // Parse role from query parameter (default: recruiter)
  const role = (new URL(request.url).searchParams.get('role') || 'recruiter') as TUserRole;

  const config = {
    clientId,
    clientSecret: '', // Not needed for URL construction
    tenantId,
    redirectUri,
  };

  // Build OAuth authorization URL and redirect
  const authUrl = authService.buildOAuthUrl(config, role);

  return NextResponse.redirect(authUrl);
}
