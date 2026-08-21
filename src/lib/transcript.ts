// Teams transcript (WebVTT) parsing and speaker attribution.
//
// Teams emits VTT cues that carry the speaker inline as a voice span:
//
//   1
//   00:00:03.120 --> 00:00:07.480
//   <v Priya Sharma>So walk me through how you'd partition that table.</v>
//
// That inline speaker name is the whole reason to prefer Teams transcripts over
// recording the call and running STT ourselves: attribution comes for free and is
// authoritative, rather than a diarizer guessing which anonymous voice is the candidate.
//
// Everything here is pure and string-only — no Graph, no DB — so it's directly testable
// against fixture VTT in the eval suite.

export interface TranscriptSegment {
  /** Speaker name exactly as Teams reported it, or null for an unattributed cue. */
  speaker: string | null;
  text: string;
  startMs: number;
  endMs: number;
}

export type SpeakerRole = 'candidate' | 'panelist' | 'unknown';

export interface AttributedSegment extends TranscriptSegment {
  role: SpeakerRole;
}

export interface SpeakerStats {
  speaker: string;
  role: SpeakerRole;
  segments: number;
  words: number;
  speakingMs: number;
  /** Share of total attributed speaking time, 0..1. */
  shareOfTime: number;
}

export interface TranscriptAnalysis {
  segments: AttributedSegment[];
  speakers: SpeakerStats[];
  totalWords: number;
  /** Total cue duration, which is speaking time — not meeting wall-clock. */
  totalSpeakingMs: number;
  /** Candidate's share of speaking time, or null if we could not identify them. */
  candidateTalkShare: number | null;
  durationMs: number;
}

// 00:01:02.500 or 01:02.500 (Teams has emitted both forms).
function parseTimestamp(raw: string): number | null {
  const match = raw.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;
  const [, h, m, sec, frac] = match;
  const ms = frac ? Number(frac.padEnd(3, '0')) : 0;
  return ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(sec)) * 1000 + ms;
}

function stripTags(text: string): string {
  return text
    .replace(/<v\s+([^>]*)>/gi, '')
    .replace(/<\/v>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Parses WebVTT into ordered segments. Tolerant by design: unknown metadata blocks,
 * NOTE/STYLE/REGION headers, cue identifiers, and \r\n line endings are all skipped
 * rather than treated as errors, because a single malformed cue shouldn't lose the
 * other forty minutes of the interview.
 */
export function parseVtt(vtt: string): TranscriptSegment[] {
  if (!vtt || !vtt.trim()) return [];

  const segments: TranscriptSegment[] = [];
  // Blank-line separated blocks, normalised for CRLF and the BOM Graph sometimes sends.
  const blocks = vtt.replace(/^﻿/, '').replace(/\r\n/g, '\n').split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const arrowIndex = lines.findIndex((l) => l.includes('-->'));
    if (arrowIndex === -1) continue; // header (WEBVTT), NOTE, STYLE, REGION — no cue here

    const [rawStart, rawEnd] = lines[arrowIndex].split('-->');
    const startMs = parseTimestamp(rawStart ?? '');
    // The end timestamp can carry cue settings after it (e.g. "align:start position:50%").
    // Trim before splitting: the leading space left by the "-->" split would otherwise
    // make the first token an empty string, and every cue would be silently dropped.
    const endMs = parseTimestamp((rawEnd ?? '').trim().split(/\s+/)[0] ?? '');
    if (startMs === null || endMs === null) continue;

    const payload = lines.slice(arrowIndex + 1);
    if (payload.length === 0) continue;

    // Speaker comes from the first <v ...> span in the cue. Teams appends a GUID to the
    // name in some tenants ("Priya Sharma <guid>"), which is noise for display.
    const voiceMatch = payload.join('\n').match(/<v\s+([^>]*)>/i);
    const speaker = voiceMatch
      ? voiceMatch[1]
        .replace(/<[^>]*>/g, '')
        // The capture stops at the first '>', so a nested tag like
        // "<v Name <8:orgid:guid>>" leaves a dangling, unterminated "<8:orgid:guid"
        // that the complete-tag strip above can't see.
        .replace(/<[^>]*$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim() || null
      : null;

    const text = stripTags(payload.join(' '));
    if (!text) continue;

    segments.push({ speaker, text, startMs, endMs: Math.max(endMs, startMs) });
  }

  return segments;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Decides which speaker is the candidate.
 *
 * Teams gives display names, not emails, so this matches on name — with the local part
 * of the candidate's email as a fallback, since display names are often missing or
 * inconsistent for external guests. Known panelist names are matched too, so a speaker
 * is only labelled 'candidate' when they match the candidate AND aren't a panelist:
 * mislabelling the panel as the candidate would corrupt the talk-time split, which is
 * the main number a reviewer would act on.
 */
export function attributeSpeakers(
  segments: TranscriptSegment[],
  identity: { candidateName: string; candidateEmail?: string; panelistNames?: string[] },
): AttributedSegment[] {
  const candidateTokens = new Set<string>();
  const candidateNorm = normalizeName(identity.candidateName || '');
  if (candidateNorm) candidateTokens.add(candidateNorm);
  if (identity.candidateEmail) {
    const local = identity.candidateEmail.split('@')[0] ?? '';
    const fromEmail = normalizeName(local.replace(/[._-]+/g, ' '));
    if (fromEmail) candidateTokens.add(fromEmail);
  }

  const panelistNorms = new Set(
    (identity.panelistNames ?? []).map(normalizeName).filter(Boolean),
  );

  const classify = (speaker: string | null): SpeakerRole => {
    if (!speaker) return 'unknown';
    const norm = normalizeName(speaker);
    if (!norm) return 'unknown';

    if (panelistNorms.has(norm)) return 'panelist';
    if (candidateTokens.has(norm)) return 'candidate';

    // Partial match both ways: Teams may render "Priya Sharma (Guest)" or just "Priya".
    for (const token of candidateTokens) {
      if (token.length >= 3 && (norm.includes(token) || token.includes(norm))) return 'candidate';
    }
    for (const panelist of panelistNorms) {
      if (panelist.length >= 3 && (norm.includes(panelist) || panelist.includes(norm))) return 'panelist';
    }
    return 'unknown';
  };

  return segments.map((segment) => ({ ...segment, role: classify(segment.speaker) }));
}

export function analyseTranscript(
  vtt: string,
  identity: { candidateName: string; candidateEmail?: string; panelistNames?: string[] },
): TranscriptAnalysis {
  const segments = attributeSpeakers(parseVtt(vtt), identity);

  const bySpeaker = new Map<string, { role: SpeakerRole; segments: number; words: number; speakingMs: number }>();
  let totalWords = 0;
  let totalSpeakingMs = 0;
  let maxEnd = 0;

  for (const segment of segments) {
    const words = countWords(segment.text);
    const duration = Math.max(0, segment.endMs - segment.startMs);
    totalWords += words;
    totalSpeakingMs += duration;
    maxEnd = Math.max(maxEnd, segment.endMs);

    const key = segment.speaker ?? 'Unknown speaker';
    const entry = bySpeaker.get(key) ?? { role: segment.role, segments: 0, words: 0, speakingMs: 0 };
    entry.segments += 1;
    entry.words += words;
    entry.speakingMs += duration;
    // A speaker's role shouldn't flip between cues, but if attribution improved partway
    // (e.g. a later cue matched), prefer the identified role over 'unknown'.
    if (entry.role === 'unknown' && segment.role !== 'unknown') entry.role = segment.role;
    bySpeaker.set(key, entry);
  }

  const speakers: SpeakerStats[] = [...bySpeaker.entries()]
    .map(([speaker, v]) => ({
      speaker,
      role: v.role,
      segments: v.segments,
      words: v.words,
      speakingMs: v.speakingMs,
      shareOfTime: totalSpeakingMs > 0 ? v.speakingMs / totalSpeakingMs : 0,
    }))
    .sort((a, b) => b.speakingMs - a.speakingMs);

  const candidateMs = speakers
    .filter((s) => s.role === 'candidate')
    .reduce((sum, s) => sum + s.speakingMs, 0);
  const identifiedCandidate = speakers.some((s) => s.role === 'candidate');

  return {
    segments,
    speakers,
    totalWords,
    totalSpeakingMs,
    candidateTalkShare: identifiedCandidate && totalSpeakingMs > 0 ? candidateMs / totalSpeakingMs : null,
    durationMs: maxEnd,
  };
}

export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
