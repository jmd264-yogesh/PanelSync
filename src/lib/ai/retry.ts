// Retry/timeout policy for provider calls.
//
// Everything here is deliberately deterministic-friendly: the sleep function and the
// jitter source are injectable so the eval suite can exercise the backoff logic without
// actually waiting, and without flaking on random values.

import { AiError, classifyProviderError } from './errors';

export interface RetryPolicy {
  /** Total attempts including the first one. */
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Wall-clock ceiling across all attempts. Prevents a slow-but-retryable failure loop from outliving the request. */
  deadlineMs: number;
  /** Per-attempt ceiling. A single hung request shouldn't consume the whole deadline. */
  attemptTimeoutMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 700,
  maxDelayMs: 8_000,
  deadlineMs: 90_000,
  attemptTimeoutMs: 45_000,
};

export interface AttemptInfo {
  attempt: number;
  error: AiError;
  delayMs: number;
}

interface RetryDeps {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Exponential backoff with full jitter. Full (rather than partial) jitter matters when
// several panelists hit "Generate" at the same time after an outage — fixed backoff
// would have them all retry in lockstep and re-overload the provider.
export function computeDelayMs(attempt: number, policy: RetryPolicy, random: () => number = Math.random): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  return Math.round(random() * exponential);
}

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label = 'operation',
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new AiError('TIMEOUT', `${label} exceeded ${timeoutMs}ms`, { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs `fn`, retrying only errors classified as retryable (provider overload, rate
 * limits, transient network faults). Terminal errors — a bad API key, a malformed
 * request — fail immediately rather than burning the deadline on a hopeless retry.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal, attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  onRetry?: (info: AttemptInfo) => void,
  deps: RetryDeps = {},
): Promise<T> {
  const sleep = deps.sleep ?? defaultSleep;
  const random = deps.random ?? Math.random;
  const now = deps.now ?? Date.now;

  const startedAt = now();
  let lastError: AiError | undefined;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    try {
      const remaining = policy.deadlineMs - (now() - startedAt);
      if (remaining <= 0) {
        throw new AiError('TIMEOUT', `Retry deadline of ${policy.deadlineMs}ms exhausted`, { cause: lastError });
      }
      return await withTimeout(
        (signal) => fn(signal, attempt),
        Math.min(policy.attemptTimeoutMs, remaining),
        `AI attempt ${attempt}`,
      );
    } catch (err) {
      const aiErr = classifyProviderError(err);
      lastError = aiErr;

      const isLastAttempt = attempt >= policy.maxAttempts;
      if (!aiErr.retryable || isLastAttempt) throw aiErr;

      const delayMs = computeDelayMs(attempt, policy, random);
      const elapsed = now() - startedAt;
      // No point sleeping if we'd wake up past the deadline anyway.
      if (elapsed + delayMs >= policy.deadlineMs) throw aiErr;

      onRetry?.({ attempt, error: aiErr, delayMs });
      await sleep(delayMs);
    }
  }

  throw lastError ?? new AiError('UNKNOWN', 'Retry loop exited without a result');
}
