import { setSession, clearSession } from '@server/lib/session';
import { authRepository } from '@server/repositories/auth/auth.repository';

export type TUserRole = 'recruiter' | 'panelist';

export type TOAuthConfig = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
};

export type TTokenData = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export type TUserProfile = {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName?: string;
};

export type TAuthSession = {
  sessionId: string;
  redirectPath: string;
};

/**
 * Auth Service - Business logic for authentication operations
 * Handles OAuth flow, token exchange, user profile fetching, and role verification
 */
export const authService = {
  /**
   * Build OAuth authorization URL for Microsoft login
   */
  buildOAuthUrl(config: TOAuthConfig, role: TUserRole): string {
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

    const state = `panelsync-auth|role=${role}`;

    return `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_mode=query&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;
  },

  /**
   * Exchange OAuth authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(
    code: string,
    config: TOAuthConfig
  ): Promise<TTokenData> {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUri,
          scope: 'openid profile offline_access User.Read User.Read.All Chat.Create ChatMessage.Send Calendars.ReadWrite',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Token exchange failed:', errText);
      throw new Error('TOKEN_EXCHANGE_FAILED');
    }

    return await tokenResponse.json();
  },

  /**
   * Fetch user profile from Microsoft Graph
   */
  async fetchUserProfile(accessToken: string): Promise<TUserProfile> {
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      const errText = await userResponse.text();
      console.error('Graph user profile request failed:', errText);
      throw new Error('USER_PROFILE_FAILED');
    }

    return await userResponse.json();
  },

  /**
   * Verify if user has access based on role
   */
  async verifyRoleAccess(
    email: string,
    role: TUserRole
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (role === 'panelist') {
      const isPanelist = await authRepository.isPanelistRegistered(email);
      if (!isPanelist) {
        console.warn(`Panelist sign-in attempt by unregistered email: ${email}`);
        return { allowed: false, reason: 'NOT_A_PANELIST' };
      }
    } else {
      const isAllowed = await authRepository.isRecruiterAllowed(email);
      if (!isAllowed) {
        console.warn(`Unauthorized recruiter sign-in attempt by email: ${email}`);
        return { allowed: false, reason: 'UNAUTHORIZED_RECRUITER' };
      }
    }

    return { allowed: true };
  },

  /**
   * Create authenticated session and return session ID and redirect path
   */
  async createSession(
    tokenData: TTokenData,
    userProfile: TUserProfile,
    role: TUserRole
  ): Promise<TAuthSession> {
    const userEmail = (userProfile.mail || userProfile.userPrincipalName || '')
      .toLowerCase()
      .trim();

    const expiresAt = Date.now() + tokenData.expires_in * 1000;

    const sessionId = await setSession({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
      user: {
        id: userProfile.id,
        displayName: userProfile.displayName,
        email: userEmail,
      },
    });

    const redirectPath = role === 'panelist' ? '/panelist' : '/dashboard';

    return {
      sessionId,
      redirectPath,
    };
  },

  /**
   * Clear user session (logout)
   */
  async destroySession(): Promise<void> {
    await clearSession();
  },

  /**
   * Extract user email from profile
   */
  extractEmail(userProfile: TUserProfile): string {
    return (userProfile.mail || userProfile.userPrincipalName || '')
      .toLowerCase()
      .trim();
  },

  /**
   * Parse role from OAuth state parameter
   */
  parseRoleFromState(state: string): TUserRole {
    return state.includes('role=panelist') ? 'panelist' : 'recruiter';
  },
};
