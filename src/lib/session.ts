import { cookies } from 'next/headers';
import { dbClient } from './db';
import { sessions } from './schema';
import { eq, desc } from 'drizzle-orm';

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

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('sessionId')?.value;
    if (!sessionId) return null;

    // Retrieve session from PostgreSQL using Drizzle
    const [sessionRow] = await dbClient
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!sessionRow) return null;

    // Check if the user is still allowed to log in (access control check)
    const { db } = await import('./db');
    const isAllowed = await db.isEmailAllowed(sessionRow.userEmail);
    if (!isAllowed) {
      console.warn(`User ${sessionRow.userEmail} session exists but is no longer authorized.`);
      return null;
    }

    return {
      accessToken: sessionRow.accessToken,
      refreshToken: sessionRow.refreshToken || undefined,
      expiresAt: sessionRow.expiresAt.getTime(),
      user: {
        id: sessionRow.userId,
        displayName: sessionRow.userDisplayName,
        email: sessionRow.userEmail,
      },
    };
  } catch (error) {
    console.error('Error fetching session cookie:', error);
    return null;
  }
}

export async function setSession(payload: SessionPayload): Promise<string> {
  const sessionId = crypto.randomUUID();
  
  // 1. Save session to Neon DB using Drizzle
  await dbClient.insert(sessions).values({
    id: sessionId,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken || null,
    expiresAt: new Date(payload.expiresAt),
    userId: payload.user.id,
    userDisplayName: payload.user.displayName,
    userEmail: payload.user.email,
  });

  // 2. Set only the small Session ID in the cookie
  const cookieStore = await cookies();
  cookieStore.set('sessionId', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });

  return sessionId;
}

export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('sessionId')?.value;
    
    if (sessionId) {
      // Delete from PostgreSQL
      await dbClient.delete(sessions).where(eq(sessions.id, sessionId));
    }

    cookieStore.delete('sessionId');
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('sessionId')?.value;
  if (!sessionId) return null;

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
        
        // Update session tokens in PostgreSQL
        await dbClient
          .update(sessions)
          .set({
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token || session.refreshToken,
            expiresAt: new Date(expiresAt),
          })
          .where(eq(sessions.id, sessionId));
        
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

export async function getAnyValidAccessToken(): Promise<{ token: string; email: string } | null> {
  try {
    const [latestSession] = await dbClient
      .select()
      .from(sessions)
      .orderBy(desc(sessions.createdAt))
      .limit(1);

    if (!latestSession) return null;

    const now = Date.now();
    const expiresAt = latestSession.expiresAt.getTime();

    if (expiresAt - now < 30 * 1000) {
      if (latestSession.refreshToken) {
        console.log('Access token expiring soon for guest booking. Refreshing token...');
        const tokens = await refreshMicrosoftTokens(latestSession.refreshToken);
        if (tokens) {
          const newExpiresAt = Date.now() + tokens.expires_in * 1000;
          await dbClient
            .update(sessions)
            .set({
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token || latestSession.refreshToken,
              expiresAt: new Date(newExpiresAt),
            })
            .where(eq(sessions.id, latestSession.id));

          return { token: tokens.access_token, email: latestSession.userEmail };
        }
      }
      return null;
    }

    return { token: latestSession.accessToken, email: latestSession.userEmail };
  } catch (error) {
    console.error('Error fetching generic valid token:', error);
    return null;
  }
}
