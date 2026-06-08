import { cookies } from 'next/headers';
import * as jose from 'jose';

const SECRET_KEY = process.env.SESSION_SECRET || 'fallback-secret-key-at-least-32-chars-long-change-in-prod';
const SECRET = new TextEncoder().encode(SECRET_KEY);

export interface SessionPayload {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Epoch milliseconds
  user: {
    id: string;
    displayName: string;
    email: string;
  };
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    console.error('Failed to verify session token:', error);
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    return await decrypt(token);
  } catch (error) {
    console.error('Error fetching session cookie:', error);
    return null;
  }
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
export async function getValidAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  // If token is expired or expiring in the next 30 seconds, refresh it
  const now = Date.now();
  if (session.expiresAt - now < 30 * 1000) {
    if (session.refreshToken) {
      console.log('Access token expiring soon. Refreshing token...');
      const tokens = await refreshMicrosoftTokens(session.refreshToken);
      if (tokens) {
        const expiresAt = Date.now() + tokens.expires_in * 1000;
        await setSession({
          ...session,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || session.refreshToken,
          expiresAt,
        });
        return tokens.access_token;
      }
    }
    return null; // Expired and can't refresh
  }

  return session.accessToken;
}

// Token refresh function directly contacting Microsoft Entra
async function refreshMicrosoftTokens(refreshToken: string) {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || 'common';

  if (!clientId || !clientSecret) {
    console.error('AZURE_CLIENT_ID or AZURE_CLIENT_SECRET not configured.');
    return null;
  }

  try {
    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: 'offline_access User.Read User.Read.All Chat.Create ChatMessage.Send Calendars.ReadWrite',
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Token refresh failed:', errBody);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Network error refreshing token:', err);
    return null;
  }
}
