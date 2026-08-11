// Typed error taxonomy for the AI layer.
//
// The point of this file is to answer one question at every call site: "is it worth
// trying again?". A 503 "model overloaded" and a 400 "your prompt is malformed" both
// arrive from the Gemini SDK as a thrown ApiError with a JSON blob in `.message`, and
// treating them the same means either burning retries on hopeless requests or failing
// a run that would have succeeded on the next attempt.

export type AiErrorKind =
  | 'RATE_LIMIT' // 429 — backed off too little; retry with a longer delay
  | 'OVERLOADED' // 503 — provider capacity, usually transient
  | 'SERVER' // 5xx other than 503
  | 'TIMEOUT' // our own deadline, not the provider's
  | 'NETWORK' // socket/DNS/fetch failure
  | 'AUTH' // 401/403 — bad or missing API key
  | 'BAD_REQUEST' // 400 — prompt/schema problem on our side
  | 'SCHEMA' // provider responded, but not in the shape we require
  | 'GUARDRAIL' // response was well-formed but failed our quality/safety checks
  | 'UNKNOWN';

const RETRYABLE: ReadonlySet<AiErrorKind> = new Set<AiErrorKind>([
  'RATE_LIMIT',
  'OVERLOADED',
  'SERVER',
  'TIMEOUT',
  'NETWORK',
]);

export class AiError extends Error {
  readonly kind: AiErrorKind;
  readonly retryable: boolean;
  readonly status?: number;
  readonly detail?: unknown;

  constructor(kind: AiErrorKind, message: string, opts: { status?: number; detail?: unknown; cause?: unknown } = {}) {
    super(message, { cause: opts.cause });
    this.name = 'AiError';
    this.kind = kind;
    this.retryable = RETRYABLE.has(kind);
    this.status = opts.status;
    this.detail = opts.detail;
  }

  // What the panelist sees. Provider internals ("ApiError: {"error":{"code":503...")
  // are useless to them and leak implementation detail into the UI.
  get userMessage(): string {
    switch (this.kind) {
      case 'RATE_LIMIT':
        return 'The AI service is rate limiting us right now. Wait a moment and try again.';
      case 'OVERLOADED':
      case 'SERVER':
        return 'The AI service is temporarily unavailable. We retried automatically — please try again in a minute.';
      case 'TIMEOUT':
        return 'Question generation took too long and was stopped. Try again, or reduce the question count.';
      case 'NETWORK':
        return 'Could not reach the AI service. Check your connection and try again.';
      case 'AUTH':
        return 'The AI service credentials are not configured correctly. Contact an administrator.';
      case 'SCHEMA':
        return 'The AI returned a malformed response we could not repair. Please try again.';
      case 'GUARDRAIL':
        return this.message;
      case 'BAD_REQUEST':
        return 'The AI request was rejected as invalid. Please try again, or adjust your spec inputs.';
      default:
        return 'Question generation failed. Please try again.';
    }
  }
}

// Pulls an HTTP status out of whatever the SDK threw. The Gemini SDK is inconsistent
// about where it puts this: sometimes `.status`, sometimes a JSON body serialized into
// `.message` (e.g. `ApiError: {"error":{"code":503,"status":"UNAVAILABLE"}}`), so we
// check the structured fields first and only then fall back to parsing the text.
function extractStatus(err: unknown): { status?: number; statusText?: string } {
  if (!err || typeof err !== 'object') return {};
  const e = err as Record<string, unknown>;

  const direct = e.status ?? e.code ?? e.statusCode;
  if (typeof direct === 'number') return { status: direct };

  const message = typeof e.message === 'string' ? e.message : '';
  if (message) {
    try {
      const start = message.indexOf('{');
      if (start !== -1) {
        const parsed = JSON.parse(message.slice(start)) as { error?: { code?: number; status?: string } };
        if (typeof parsed?.error?.code === 'number') {
          return { status: parsed.error.code, statusText: parsed.error.status };
        }
      }
    } catch {
      // fall through to the regex below
    }
    const match = message.match(/\b(4\d\d|5\d\d)\b/);
    if (match) return { status: Number(match[1]) };
  }

  return {};
}

export function classifyProviderError(err: unknown): AiError {
  if (err instanceof AiError) return err;

  const message = err instanceof Error ? err.message : String(err);
  const { status, statusText } = extractStatus(err);
  const lower = `${message} ${statusText ?? ''}`.toLowerCase();

  if (status === 429 || lower.includes('resource_exhausted') || lower.includes('rate limit') || lower.includes('quota')) {
    return new AiError('RATE_LIMIT', message, { status, cause: err });
  }
  if (status === 503 || lower.includes('unavailable') || lower.includes('overloaded') || lower.includes('high demand')) {
    return new AiError('OVERLOADED', message, { status, cause: err });
  }
  if (status === 401 || status === 403 || lower.includes('api key') || lower.includes('permission denied')) {
    return new AiError('AUTH', message, { status, cause: err });
  }
  if (status === 400 || lower.includes('invalid argument')) {
    return new AiError('BAD_REQUEST', message, { status, cause: err });
  }
  if (typeof status === 'number' && status >= 500) {
    return new AiError('SERVER', message, { status, cause: err });
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('aborted')) {
    return new AiError('TIMEOUT', message, { status, cause: err });
  }
  if (
    lower.includes('fetch failed')
    || lower.includes('econnreset')
    || lower.includes('enotfound')
    || lower.includes('socket hang up')
    || lower.includes('network')
  ) {
    return new AiError('NETWORK', message, { status, cause: err });
  }

  return new AiError('UNKNOWN', message, { status, cause: err });
}
