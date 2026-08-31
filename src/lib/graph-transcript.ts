// Teams meeting transcript retrieval from Microsoft Graph.
//
// Deliberately app-only (client credentials) rather than delegated, for two reasons:
//
//  1. Graph exposes a meeting's transcripts only under its organizer. The organizer is
//     the recruiter who created the calendar event, but the person who wants the
//     transcript is the panelist who ran the interview — a delegated call would need
//     the organizer to be signed in at that moment, which they usually aren't.
//  2. Adding a delegated scope to the sign-in request breaks login outright until an
//     admin consents to it (see the Files.Read comment in api/auth/signin). App-only
//     keeps the login flow untouched: if consent is missing, transcript sync fails with
//     a clear message and nothing else regresses.
//
// Required Azure AD *application* permissions, admin-consented:
//   OnlineMeetings.Read.All            — resolve a meeting from its join URL
//   OnlineMeetingTranscript.Read.All   — list and download transcripts
// See docs/TRANSCRIPTS.md for the setup walkthrough.

export class TranscriptError extends Error {
  readonly code:
    | 'NOT_CONFIGURED'
    | 'CONSENT_REQUIRED'
    | 'NO_ORGANIZER'
    | 'MEETING_NOT_FOUND'
    | 'NO_TRANSCRIPT'
    | 'GRAPH_ERROR';
  readonly status: number;

  constructor(code: TranscriptError['code'], message: string, status = 400) {
    super(message);
    this.name = 'TranscriptError';
    this.code = code;
    this.status = status;
  }
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cachedAppToken: CachedToken | null = null;

/**
 * Client-credentials token for app-only Graph calls, cached until shortly before it
 * expires. Tokens last an hour; re-fetching per request would add latency and needless
 * load on the token endpoint.
 */
async function getAppToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new TranscriptError(
      'NOT_CONFIGURED',
      'Transcript sync needs AZURE_TENANT_ID, AZURE_CLIENT_ID and AZURE_CLIENT_SECRET to be configured.',
      500,
    );
  }

  if (cachedAppToken && cachedAppToken.expiresAt > Date.now() + 60_000) {
    return cachedAppToken.token;
  }

  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
      scope: 'https://graph.microsoft.com/.default',
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (body as { error_description?: string }).error_description ?? res.statusText;
    throw new TranscriptError('GRAPH_ERROR', `Could not obtain an app token: ${detail}`, 502);
  }

  const token = (body as { access_token?: string; expires_in?: number }).access_token;
  if (!token) throw new TranscriptError('GRAPH_ERROR', 'Token endpoint returned no access_token.', 502);

  cachedAppToken = {
    token,
    expiresAt: Date.now() + ((body as { expires_in?: number }).expires_in ?? 3600) * 1000,
  };
  return token;
}

async function graphAppFetch(path: string, accept = 'application/json'): Promise<Response> {
  const token = await getAppToken();
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: accept },
  });
}

/** Turns a Graph failure into something that tells the caller what to actually fix. */
async function toTranscriptError(res: Response, context: string): Promise<TranscriptError> {
  const text = await res.text().catch(() => '');
  if (res.status === 401 || res.status === 403) {
    return new TranscriptError(
      'CONSENT_REQUIRED',
      `Microsoft Graph refused the request (${res.status}) while ${context}. This usually means the app registration is missing admin consent for OnlineMeetings.Read.All and OnlineMeetingTranscript.Read.All (application permissions). See docs/TRANSCRIPTS.md.`,
      403,
    );
  }
  return new TranscriptError('GRAPH_ERROR', `Graph error ${res.status} while ${context}: ${text.slice(0, 400)}`, 502);
}

/**
 * Finds the onlineMeeting id for a Teams join URL.
 *
 * The join URL stored on the interview comes from the calendar event, and can carry
 * extra query parameters that the Graph filter won't match, so the bare URL is tried
 * as a fallback.
 */
export async function resolveOnlineMeetingId(organizerUserId: string, joinWebUrl: string): Promise<string> {
  const candidates = [joinWebUrl];
  const withoutQuery = joinWebUrl.split('?')[0];
  if (withoutQuery && withoutQuery !== joinWebUrl) candidates.push(withoutQuery);

  for (const url of candidates) {
    const path = `/users/${encodeURIComponent(organizerUserId)}/onlineMeetings?$filter=joinWebUrl eq '${encodeURIComponent(url)}'`;
    const res = await graphAppFetch(path);
    if (!res.ok) throw await toTranscriptError(res, 'looking up the Teams meeting');

    const body = (await res.json()) as { value?: { id?: string }[] };
    const id = body.value?.[0]?.id;
    if (id) return id;
  }

  throw new TranscriptError(
    'MEETING_NOT_FOUND',
    'Could not find this Teams meeting in Graph. It may have been created outside this app, or the organizer recorded on the interview may be wrong.',
    404,
  );
}

export interface GraphTranscript {
  id: string;
  createdDateTime: string | null;
}

export async function listTranscripts(organizerUserId: string, onlineMeetingId: string): Promise<GraphTranscript[]> {
  const path = `/users/${encodeURIComponent(organizerUserId)}/onlineMeetings/${encodeURIComponent(onlineMeetingId)}/transcripts`;
  const res = await graphAppFetch(path);
  if (!res.ok) throw await toTranscriptError(res, 'listing meeting transcripts');

  const body = (await res.json()) as { value?: { id: string; createdDateTime?: string }[] };
  return (body.value ?? []).map((t) => ({ id: t.id, createdDateTime: t.createdDateTime ?? null }));
}

/** Downloads one transcript as WebVTT. */
export async function fetchTranscriptVtt(
  organizerUserId: string,
  onlineMeetingId: string,
  transcriptId: string,
): Promise<string> {
  const path = `/users/${encodeURIComponent(organizerUserId)}/onlineMeetings/${encodeURIComponent(onlineMeetingId)}/transcripts/${encodeURIComponent(transcriptId)}/content?$format=text/vtt`;
  const res = await graphAppFetch(path, 'text/vtt');
  if (!res.ok) throw await toTranscriptError(res, 'downloading the transcript');
  return res.text();
}
