import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { AiError, classifyProviderError } from './errors';
import { DEFAULT_RETRY_POLICY, withRetry, type RetryPolicy } from './retry';

export interface GenerateStructuredArgs<T> {
  systemPrompt: string;
  userPrompt: string;
  zodSchema: z.ZodType<T>;
  /** Overrides the default retry policy for this call (e.g. a shorter budget for the critic). */
  retryPolicy?: RetryPolicy;
  /** Lower for judgement/critique passes where we want consistency over creativity. */
  temperature?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GenerateStructuredResult<T> {
  data: T;
  model: string;
  tokenUsage: TokenUsage;
  /** Observability: how hard we had to work for this result. */
  telemetry: {
    /** Transport-level attempts, including retries for overload/rate-limit/network. */
    transportAttempts: number;
    /** Whether the first response failed schema validation and needed a repair round-trip. */
    schemaRepairUsed: boolean;
    latencyMs: number;
  };
}

export interface TranscribeAudioArgs {
  audioBase64: string;
  mimeType: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
}

// Single seam between the app and whichever LLM backs the copilot today.
// Swap this file's implementation to move to the internal AI later — every
// caller only ever depends on this interface, never on the Gemini SDK directly.
export interface StructuredAiProvider {
  generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<GenerateStructuredResult<T>>;
  transcribeAudio(args: TranscribeAudioArgs): Promise<{ transcriptText: string; model: string }>;
}

function emptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

class GeminiProvider implements StructuredAiProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AiError('AUTH', 'GEMINI_API_KEY is not configured.');
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  }

  async generateStructured<T>({
    systemPrompt,
    userPrompt,
    zodSchema,
    retryPolicy = DEFAULT_RETRY_POLICY,
    temperature,
    signal,
  }: GenerateStructuredArgs<T>): Promise<GenerateStructuredResult<T>> {
    // Constrain Gemini's decoding to the schema's actual shape (not just prose in the
    // prompt) — without this, the model periodically simplifies nested object arrays
    // (e.g. rubric bands) into plain strings, which then fails validation below.
    const responseJsonSchema = z.toJSONSchema(zodSchema, { unrepresentable: 'any' });
    const startedAt = Date.now();
    let usage = emptyUsage();
    let transportAttempts = 0;

    // One network call. Transient provider failures (503/429/network) are retried by the
    // caller-supplied policy; everything else fails fast.
    const callOnce = async (prompt: string): Promise<string> =>
      withRetry(
        async (timeoutSignal, attempt) => {
          transportAttempts = Math.max(transportAttempts, attempt);
          if (signal?.aborted) throw new AiError('TIMEOUT', 'Request aborted by caller');
          try {
            const response = await this.client.models.generateContent({
              model: this.model,
              contents: prompt,
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseJsonSchema,
                ...(temperature !== undefined ? { temperature } : {}),
                abortSignal: timeoutSignal,
              },
            });
            const text = response.text;
            if (!text) throw new AiError('SCHEMA', 'The AI service returned an empty response.');

            const meta = response.usageMetadata;
            usage = addUsage(usage, {
              promptTokens: meta?.promptTokenCount ?? 0,
              completionTokens: meta?.candidatesTokenCount ?? 0,
              totalTokens: meta?.totalTokenCount ?? 0,
            });
            return text;
          } catch (err) {
            throw classifyProviderError(err);
          }
        },
        retryPolicy,
      );

    const first = await callOnce(userPrompt);
    const firstParsed = safeJsonParse(first);
    const firstResult = firstParsed ? zodSchema.safeParse(firstParsed) : null;
    if (firstResult?.success) {
      return {
        data: firstResult.data,
        model: this.model,
        tokenUsage: usage,
        telemetry: { transportAttempts, schemaRepairUsed: false, latencyMs: Date.now() - startedAt },
      };
    }

    // One repair round-trip: show the model its own output and the validation errors.
    // This is schema conformance only — semantic quality repair lives in generate.ts.
    const errorDetail = firstResult ? JSON.stringify(firstResult.error.issues) : 'The response was not valid JSON.';
    const repairPrompt = `${userPrompt}\n\nYour previous response failed schema validation.\nPrevious response:\n${first}\n\nValidation errors:\n${errorDetail}\n\nReturn corrected JSON only, matching the required schema exactly.`;

    const second = await callOnce(repairPrompt);
    const secondParsed = safeJsonParse(second);
    const secondResult = secondParsed ? zodSchema.safeParse(secondParsed) : null;
    if (!secondResult?.success) {
      throw new AiError(
        'SCHEMA',
        `AI response failed schema validation after a repair attempt: ${secondResult ? JSON.stringify(secondResult.error.issues) : 'invalid JSON'}`,
        { detail: secondResult?.error.issues },
      );
    }

    return {
      data: secondResult.data,
      model: this.model,
      tokenUsage: usage,
      telemetry: { transportAttempts, schemaRepairUsed: true, latencyMs: Date.now() - startedAt },
    };
  }

  async transcribeAudio({
    audioBase64,
    mimeType,
    systemPrompt,
    userPrompt,
    temperature = 0.0,
  }: TranscribeAudioArgs): Promise<{ transcriptText: string; model: string }> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              {
                text: userPrompt || 'Transcribe the audio of this technical interview recording completely and accurately. Label speakers clearly (Interviewer: / Candidate:) and include timestamps [MM:SS] where possible.',
              },
            ],
          },
        ],
        config: {
          systemInstruction: systemPrompt || 'You are an accurate technical speech-to-text transcriptionist for engineering interviews. Transcribe every technical discussion, coding explanation, and dialogue faithfully with speaker tags.',
          temperature,
        },
      });

      const transcriptText = response.text || '';
      return { transcriptText, model: this.model };
    } catch (err) {
      throw classifyProviderError(err);
    }
  }
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    // Models occasionally wrap JSON in prose or a markdown fence despite the mime type.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch {
        return null;
      }
    }
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

let providerInstance: StructuredAiProvider | null = null;
export function getAiProvider(): StructuredAiProvider {
  if (!providerInstance) {
    providerInstance = new GeminiProvider();
  }
  return providerInstance;
}

/** Test seam — lets the eval suite run the full pipeline against a scripted provider. */
export function setAiProvider(provider: StructuredAiProvider | null): void {
  providerInstance = provider;
}
