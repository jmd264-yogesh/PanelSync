// In-person interview speaker handling.
//
// A Teams transcript names every speaker from their account, but an in-person recording
// is one room microphone. Letting the transcription model guess "Interviewer" vs the
// candidate's name silently mis-attributes answers, and a panelist's answer scored as the
// candidate's corrupts the evaluation. So in person the flow is:
//
//   1. transcribe with neutral labels ("Speaker 1", "Speaker 2", ...)
//   2. summarise each label (talk share + sample lines) and let AI *suggest* roles
//   3. a panelist confirms who is who (exactly one person is the candidate)
//   4. rewrite the transcript with confirmed names/roles, then evaluate
//
// Everything here is pure (no DB, no network) so the server route and the review UI
// share one definition of "valid mapping" and "role-tagged transcript".

import type { SpeakerAssignment, SpeakerMap, TranscriptDialogueTurn } from './db';

export interface SpeakerSummary {
  label: string;
  turns: number;
  words: number;
  /** Fraction (0-1) of all transcribed words spoken under this label. */
  share: number;
  /** A few representative lines, longest first, so the panelist can recognise the voice. */
  samples: string[];
  /** How many of this speaker's turns end in a question mark — interviewers ask, candidates answer. */
  questions: number;
}

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** Labels the transcriber produced, in order of first appearance. */
export function speakerLabels(turns: TranscriptDialogueTurn[]): string[] {
  const seen: string[] = [];
  for (const t of turns) {
    const label = t.sourceLabel ?? t.speaker;
    if (label && !seen.includes(label)) seen.push(label);
  }
  return seen;
}

export function summarizeSpeakers(turns: TranscriptDialogueTurn[]): SpeakerSummary[] {
  const total = turns.reduce((sum, t) => sum + wordCount(t.text), 0) || 1;
  return speakerLabels(turns).map((label) => {
    const own = turns.filter((t) => (t.sourceLabel ?? t.speaker) === label);
    const words = own.reduce((sum, t) => sum + wordCount(t.text), 0);
    const samples = [...own]
      .map((t) => t.text.trim())
      .filter((text) => wordCount(text) >= 6)
      .sort((a, b) => b.length - a.length)
      .slice(0, 3)
      .map((text) => (text.length > 220 ? `${text.slice(0, 217)}…` : text));
    return {
      label,
      turns: own.length,
      words,
      share: words / total,
      samples: samples.length ? samples : own.slice(0, 2).map((t) => t.text.trim()),
      questions: own.filter((t) => t.text.trim().endsWith('?')).length,
    };
  });
}

export interface SpeakerMapCheck {
  ok: boolean;
  error?: string;
}

/** A mapping is usable once every label is assigned and at least one label is the candidate. */
export function validateSpeakerMap(map: SpeakerMap, labels: string[]): SpeakerMapCheck {
  const missing = labels.filter((l) => !map[l] || !['candidate', 'panelist', 'ignore'].includes(map[l].role));
  if (missing.length) return { ok: false, error: `Assign every speaker (missing: ${missing.join(', ')}).` };
  if (!labels.some((l) => map[l].role === 'candidate')) {
    return { ok: false, error: 'Mark which speaker is the candidate.' };
  }
  return { ok: true };
}

/**
 * Replaces diarizer labels with confirmed identities. Ignored speakers (cross-talk,
 * someone passing through) are dropped. The original label is kept on `sourceLabel`
 * so the mapping can be reviewed and changed later without re-transcribing.
 */
export function applySpeakerMap(
  turns: TranscriptDialogueTurn[],
  map: SpeakerMap,
  candidateName: string,
): TranscriptDialogueTurn[] {
  const out: TranscriptDialogueTurn[] = [];
  for (const t of turns) {
    const label = t.sourceLabel ?? t.speaker;
    const a: SpeakerAssignment | undefined = map[label];
    if (!a || a.role === 'ignore') continue;
    out.push({
      ...t,
      sourceLabel: label,
      role: a.role,
      speaker: a.role === 'candidate' ? candidateName : (a.name?.trim() || 'Panelist'),
    });
  }
  return out;
}

/**
 * The transcript handed to the evaluator once roles are confirmed. Every line carries an
 * explicit CANDIDATE/PANEL tag so the model never has to infer who said what.
 */
export function buildRoleTaggedTranscript(turns: TranscriptDialogueTurn[]): string {
  return turns
    .map((t) => {
      const tag = t.role === 'candidate' ? `CANDIDATE (${t.speaker})` : `PANEL (${t.speaker})`;
      return `${t.timestamp ? `[${t.timestamp}] ` : ''}${tag}: ${t.text}`;
    })
    .join('\n');
}

/**
 * Carries a previous (confirmed or suggested) mapping over to a new transcript: labels
 * that still exist keep their assignment, new labels fall back to the AI suggestion.
 */
export function mergeSpeakerMaps(previous: SpeakerMap | null, suggested: SpeakerMap, labels: string[]): SpeakerMap {
  const merged: SpeakerMap = {};
  for (const label of labels) {
    if (previous?.[label] && !previous[label].suggested) merged[label] = previous[label];
    else if (suggested[label]) merged[label] = suggested[label];
  }
  return merged;
}
