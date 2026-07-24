import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export interface GenerateStructuredArgs<T> {
  systemPrompt: string;
  userPrompt: string;
  zodSchema: z.ZodType<T>;
}

export interface GenerateStructuredResult<T> {
  data: T;
  model: string;
  tokenUsage: { promptTokens: number; completionTokens: number; totalTokens: number };
}

// Single seam between the app and whichever LLM backs the copilot today.
// Swap this file's implementation to move to the internal AI later — every
// caller only ever depends on this interface, never on the Gemini SDK directly.
export interface StructuredAiProvider {
  generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<GenerateStructuredResult<T>>;
}

class GeminiProvider implements StructuredAiProvider {
  private client: GoogleGenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }
    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
  }

  async generateStructured<T>({ systemPrompt, userPrompt, zodSchema }: GenerateStructuredArgs<T>): Promise<GenerateStructuredResult<T>> {
    // Constrain Gemini's decoding to the schema's actual shape (not just prose in the
    // prompt) — without this, the model periodically simplifies nested object arrays
    // (e.g. rubric bands) into plain strings, which then fails validation below.
    const responseJsonSchema = z.toJSONSchema(zodSchema, { unrepresentable: 'any' });

    const attempt = async (prompt: string) => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseJsonSchema,
        },
      });
      const text = response.text;
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }
      const usage = response.usageMetadata;
      return {
        raw: text,
        tokenUsage: {
          promptTokens: usage?.promptTokenCount ?? 0,
          completionTokens: usage?.candidatesTokenCount ?? 0,
          totalTokens: usage?.totalTokenCount ?? 0,
        },
      };
    };

    const first = await attempt(userPrompt);
    const firstParsed = safeJsonParse(first.raw);
    const firstResult = firstParsed ? zodSchema.safeParse(firstParsed) : null;
    if (firstResult?.success) {
      return { data: firstResult.data, model: this.model, tokenUsage: first.tokenUsage };
    }

    // One repair round-trip: show the model its own output and the validation errors.
    const errorDetail = firstResult
      ? JSON.stringify(firstResult.error.issues)
      : 'The response was not valid JSON.';
    const repairPrompt = `${userPrompt}\n\nYour previous response failed schema validation.\nPrevious response:\n${first.raw}\n\nValidation errors:\n${errorDetail}\n\nReturn corrected JSON only, matching the required schema exactly.`;

    const second = await attempt(repairPrompt);
    const secondParsed = safeJsonParse(second.raw);
    const secondResult = secondParsed ? zodSchema.safeParse(secondParsed) : null;
    if (!secondResult?.success) {
      throw new Error(`Gemini response failed schema validation after repair attempt: ${secondResult ? JSON.stringify(secondResult.error.issues) : 'invalid JSON'}`);
    }

    return {
      data: secondResult.data,
      model: this.model,
      tokenUsage: {
        promptTokens: first.tokenUsage.promptTokens + second.tokenUsage.promptTokens,
        completionTokens: first.tokenUsage.completionTokens + second.tokenUsage.completionTokens,
        totalTokens: first.tokenUsage.totalTokens + second.tokenUsage.totalTokens,
      },
    };
  }
}

function safeJsonParse(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
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
