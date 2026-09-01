import { z } from 'zod';
import { getAiProvider } from './provider';
import type { QuestionSet, Spec } from './schemas';
import { rubricDimensionsWithBands, ORG_TIER_LABEL, getOrgTier } from './org-rubric';

export const QuestionEvaluationSchema = z.object({
  questionId: z.string(),
  suggestedScore: z.coerce.number().int().min(1).max(4).catch(1), // 1: Does Not Meet, 2: Approaching, 3: Meets, 4: Exceeds
  candidateAnswerSummary: z.string().catch('No answer recorded in transcript.'),
  verbatimQuote: z.string().nullable().optional().default(null),
  reasoning: z.string().catch(''),
  strengths: z.array(z.string()).optional().default([]),
  gaps: z.array(z.string()).optional().default([]),
});
export type QuestionEvaluation = z.infer<typeof QuestionEvaluationSchema>;

export const RubricDimensionEvaluationSchema = z.object({
  suggestedScore: z.coerce.number().int().min(1).max(4).catch(1),
  reasoning: z.string().catch(''),
});
export type RubricDimensionEvaluation = z.infer<typeof RubricDimensionEvaluationSchema>;

export const TranscriptEvaluationSchema = z.object({
  overallSummary: z.string().catch(''),
  questionEvaluations: z.array(QuestionEvaluationSchema).default([]),
  rubricEvaluations: z.record(z.string(), RubricDimensionEvaluationSchema).default({}),
  confidence: z.enum(['high', 'medium', 'low']).catch('medium'),
});
export type TranscriptEvaluation = z.infer<typeof TranscriptEvaluationSchema>;

export interface EvaluateTranscriptInput {
  transcriptText: string;
  questionSet: QuestionSet | any;
  spec?: Spec | null;
  candidateName: string;
  roleTitle: string;
  signal?: AbortSignal;
}

export async function evaluateTranscriptWithAi(input: EvaluateTranscriptInput): Promise<TranscriptEvaluation & { evaluatedAt: string }> {
  const { transcriptText, questionSet, spec, candidateName, roleTitle, signal } = input;
  const provider = getAiProvider();

  const qList = Array.isArray(questionSet)
    ? questionSet
    : (questionSet?.questions && Array.isArray(questionSet.questions) ? questionSet.questions : []);

  const questionsFormatted = qList.map((q: any, idx: number) => {
    const rubricList = Array.isArray(q.rubric) ? q.rubric : [];
    const rubricText = rubricList.map((r: any) => {
      const signals = Array.isArray(r.exampleSignals) ? r.exampleSignals.join(', ') : (r.exampleSignals || '');
      return `  - Band ${r.band || '1'}: ${r.description || ''}${signals ? ` (Signals: ${signals})` : ''}`;
    }).join('\n');

    return `
Question #${idx + 1} (ID: ${q.id})
Category: ${q.category || 'General'}
Difficulty: ${q.difficulty || 'medium'}
Max Marks: ${q.maxMarks || 5}
Prompt: ${q.question || ''}
Model Answer Guidance: ${q.modelAnswer || 'N/A'}
Rubric Bands:
${rubricText || '  - Band 1: Does Not Meet\n  - Band 2: Meets\n  - Band 3: Exceeds'}
`;
  }).join('\n---\n');

  const roleGrade = spec?.roleGrade || 'se';
  const orgTier = getOrgTier(roleGrade);
  const dims = rubricDimensionsWithBands(roleGrade, spec?.techStacks);
  const requiredDimensionLabels = dims.map((d) => d.label);

  const rubricContext = `
Organization Calibration Level: ${ORG_TIER_LABEL[orgTier]} (${roleGrade.toUpperCase()})
Key Rubric Dimensions to evaluate (use these EXACT string labels as keys in rubricEvaluations):
${dims.map((d) => `
- "${d.label}":
  Band 1 (Does Not Meet): ${d.bands[0]}
  Band 2 (Approaching): ${d.bands[1]}
  Band 3 (Meets): ${d.bands[2]}
  Band 4 (Exceeds): ${d.bands[3]}
`).join('\n')}
`;

  const systemPrompt = `You are an expert technical interview evaluator and calibration auditor for a senior technical hiring panel.
Your goal is to parse a raw Microsoft Teams interview transcript, locate where each interview question was asked and answered, evaluate the candidate's technical response objectively against the question's rubric bands, and assign a 1-4 score.

Grading Scale (Org 1-4 standard):
1 = Does Not Meet Expectation (Significant conceptual gaps, incorrect implementation, unable to solve or explain)
2 = Approaching Expectation (Basic grasp, partial solution, needed heavy interviewer coaching, missed edge cases)
3 = Meets Expectation (Solid, accurate solution, explains trade-offs, answers clearly, meets senior bar)
4 = Exceeds Expectation (Mastery, discusses architectural nuance, proactive optimizations, flawless communication)

Evaluation Instructions:
1. Candidate Attribution: Identify statements made by the candidate (${candidateName}) vs the interviewer/panelist.
2. Question Matching: Match transcript segments to each of the ${questionSet.questions.length} questions. If a question was skipped or not reached in the interview, assign score 1 with candidateAnswerSummary "Question was not asked/addressed in this transcript."
3. Evidence & Verbatim Quotes: Extract genuine, concise verbatim quotes or direct paraphrases from the transcript representing what the candidate actually stated.
4. Rubric & Scores: Map the candidate's actual answer to the closest 1-4 score. Be fair, objective, and evidence-based.
5. Overall Rubric Grid: In rubricEvaluations, provide a 1-4 score and reasoning for EACH dimension. The keys of rubricEvaluations MUST EXACTLY MATCH these dimension labels: ${requiredDimensionLabels.map((l) => `"${l}"`).join(', ')}.

Respond with JSON only, conforming strictly to the requested schema.`;

  const userPrompt = `Interview Details:
Candidate Name: ${candidateName}
Role / Round: ${roleTitle}

Questions to evaluate:
${questionsFormatted}

${rubricContext}

Meeting Transcript:
<<<TRANSCRIPT_START>>>
${transcriptText.slice(0, 45000)}
<<<TRANSCRIPT_END>>>

Generate the complete JSON evaluation.`;

  const result = await provider.generateStructured({
    systemPrompt,
    userPrompt,
    zodSchema: TranscriptEvaluationSchema,
    signal,
  });

  return {
    ...result.data,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Scans a transcript string to find the last timestamp, adds offsetSeconds (default 5s),
 * and formats it back as HH:MM:SS.
 */
export function extractLastTimestampAndAddOffset(
  transcriptText: string | null | undefined,
  offsetSeconds: number = 5,
): { lastTimestamp: string; nextStartTimestamp: string } | null {
  if (!transcriptText || !transcriptText.trim()) return null;

  // Match timestamps like [00:05:30], [05:30], 00:05:30.000, 05:30
  const timestampRegex = /(?:\[)?\b(?:(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[\.,]\d{1,3})?)\b(?:\])?/g;
  const matches = [...transcriptText.matchAll(timestampRegex)];

  if (matches.length === 0) return null;

  const lastMatch = matches[matches.length - 1];
  const hhStr = lastMatch[1]; // may be undefined
  const mmStr = lastMatch[2];
  const ssStr = lastMatch[3];

  let totalSeconds = 0;
  if (hhStr !== undefined) {
    totalSeconds = parseInt(hhStr, 10) * 3600 + parseInt(mmStr, 10) * 60 + parseInt(ssStr, 10);
  } else {
    totalSeconds = parseInt(mmStr, 10) * 60 + parseInt(ssStr, 10);
  }

  const formatSec = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const lastTimestamp = formatSec(totalSeconds);
  const nextStartTimestamp = formatSec(totalSeconds + offsetSeconds);

  return { lastTimestamp, nextStartTimestamp };
}

export interface TranscribeAudioInput {
  audioBase64: string;
  mimeType: string;
  candidateName: string;
  roleTitle: string;
  existingTranscriptText?: string | null;
  signal?: AbortSignal;
}

export async function transcribeAudioWithAi(input: TranscribeAudioInput): Promise<{ transcriptText: string; model: string }> {
  const { audioBase64, mimeType, candidateName, roleTitle, existingTranscriptText } = input;
  const provider = getAiProvider();

  let contextPrompt = '';
  if (existingTranscriptText && existingTranscriptText.trim()) {
    const timingInfo = extractLastTimestampAndAddOffset(existingTranscriptText, 5);
    const timingInstruction = timingInfo
      ? `\n- CONTINUOUS TIMING (+5s buffer): The previous interview segment ended at timestamp [${timingInfo.lastTimestamp}]. You MUST START all timestamps for this new audio recording starting from [${timingInfo.nextStartTimestamp}] onwards and increase continuously from there (e.g. "[${timingInfo.nextStartTimestamp}] Interviewer: ..."). Do NOT restart timestamps at [00:00].`
      : '';

    contextPrompt = `

Context from previous interview recording segment(s) so far:
<<<PREVIOUS_TRANSCRIPT_START>>>
${existingTranscriptText.slice(-15000)}
<<<PREVIOUS_TRANSCRIPT_END>>>

Important Continuation Instructions:
- Seamless continuation: Transcribe this new audio recording as a seamless continuation of the interview above. Maintain consistent speaker attribution (e.g. "${candidateName}:", "Interviewer:") and technical terminology.${timingInstruction}`;
  }

  const systemPrompt = `You are a precision speech-to-text audio transcriptionist for technical interviews.
Transcribe ONLY the words and sentences that are audibly and clearly spoken in the audio recording.

CRITICAL RULES:
1. STRICT FIDELITY: Transcribe only actual spoken dialogue. NEVER invent, imagine, hallucinate, or extrapolate fictional interview dialogue, greetings, pleasantries, or questions that were not spoken in the audio file.
2. SILENCE / UNINTELLIGIBLE AUDIO: If the audio is silent, contains only background room noise, clicks, breaths, or lacks intelligible human speech, return "[No speech detected in audio recording]" or an empty string. Do NOT fabricate an interview script.
3. FORMATTING: Format each dialogue turn on its own paragraph with accurate timestamps based on when the words were spoken (e.g. "[00:01:23] Interviewer: ..." or "[01:23] ${candidateName}: ...").
4. SPEAKERS: Label speakers accurately (e.g. "Interviewer:", "${candidateName}:"). Do NOT use markdown bold formatting around speaker names (do NOT write **Interviewer:**).
5. ACCURACY: Preserve technical terms, library names, framework details, and code explanations verbatim.${contextPrompt}`;

  const userPrompt = `Transcribe the audio recording for candidate ${candidateName} interviewing for ${roleTitle}. Output only what was audibly spoken in the recording with timestamps and speaker tags. If no human speech is heard, output "[No speech detected in audio recording]".`;

  return await provider.transcribeAudio({
    audioBase64,
    mimeType,
    systemPrompt,
    userPrompt,
    temperature: 0.0,
  });
}
