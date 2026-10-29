// Cases for the in-person interview flow: neutral "Speaker N" transcripts, the panelist's
// who-is-who mapping, and the role-tagged transcript the evaluator scores. A wrong
// mapping means a panelist's words get scored as the candidate's, so these pin down
// exactly what is and isn't accepted.

import { parseDialogueTurns } from '../src/lib/transcript';
import {
  applySpeakerMap, buildRoleTaggedTranscript, mergeSpeakerMaps, speakerLabels, summarizeSpeakers, validateSpeakerMap,
} from '../src/lib/in-person';
import { isTranscriptEmptyOrNoSpeech } from '../src/lib/ai/transcript-evaluator';
import type { SpeakerMap } from '../src/lib/db';

export interface InPersonCase {
  name: string;
  run: () => { ok: boolean; detail?: string };
}

const ROOM_TRANSCRIPT = `[00:00:02] Speaker 1: Thanks for coming in. How would you design ingestion for ten portfolio companies?
[00:00:09] Speaker 2: I would start by asking which systems each company runs, because half are on-prem SQL Server and half expose APIs, so the ingestion pattern differs.
[00:00:25] Speaker 3: What about a newly acquired business, how fast could it be onboarded?
[00:00:31] Speaker 2: If the bronze layer is source-agnostic and the mapping to a common chart of accounts is metadata-driven, onboarding is mostly configuration.
[00:00:44] Speaker 1: Good, and how would you govern it?`;

const turns = parseDialogueTurns(ROOM_TRANSCRIPT);

const MAP: SpeakerMap = {
  'Speaker 1': { role: 'panelist', name: 'Priya Sharma' },
  'Speaker 2': { role: 'candidate' },
  'Speaker 3': { role: 'panelist', name: 'Ben Okoro' },
};

export const IN_PERSON_CASES: InPersonCase[] = [
  {
    name: 'finds every neutral speaker label in order of first appearance',
    run: () => {
      const labels = speakerLabels(turns);
      return { ok: labels.join(',') === 'Speaker 1,Speaker 2,Speaker 3', detail: labels.join(',') };
    },
  },
  {
    name: 'summarises talk share and questions per speaker',
    run: () => {
      const s = summarizeSpeakers(turns);
      const candidate = s.find((x) => x.label === 'Speaker 2');
      const panel = s.find((x) => x.label === 'Speaker 1');
      const ok = !!candidate && !!panel && candidate.share > 0.5 && candidate.questions === 0 && panel.questions === 2;
      return { ok, detail: JSON.stringify(s.map((x) => [x.label, x.share.toFixed(2), x.questions])) };
    },
  },
  {
    name: 'rejects a mapping with no candidate',
    run: () => {
      const r = validateSpeakerMap({ ...MAP, 'Speaker 2': { role: 'panelist' } }, speakerLabels(turns));
      return { ok: !r.ok && /candidate/i.test(r.error ?? ''), detail: r.error };
    },
  },
  {
    name: 'rejects a mapping that leaves a speaker unassigned',
    run: () => {
      const partial: SpeakerMap = { 'Speaker 1': MAP['Speaker 1'], 'Speaker 2': MAP['Speaker 2'] };
      const r = validateSpeakerMap(partial, speakerLabels(turns));
      return { ok: !r.ok && (r.error ?? '').includes('Speaker 3'), detail: r.error };
    },
  },
  {
    name: 'accepts two labels mapped to the candidate (one voice split in two)',
    run: () => {
      const r = validateSpeakerMap({ ...MAP, 'Speaker 3': { role: 'candidate' } }, speakerLabels(turns));
      return { ok: r.ok, detail: r.error };
    },
  },
  {
    name: 'replaces labels with confirmed names and roles, keeping the original label',
    run: () => {
      const applied = applySpeakerMap(turns, MAP, 'Arjun Mehta');
      const ok = applied.length === 5
        && applied[1].speaker === 'Arjun Mehta' && applied[1].role === 'candidate' && applied[1].sourceLabel === 'Speaker 2'
        && applied[2].speaker === 'Ben Okoro' && applied[2].role === 'panelist';
      return { ok, detail: JSON.stringify(applied.map((t) => [t.speaker, t.role])) };
    },
  },
  {
    name: 'drops ignored speakers from the confirmed transcript',
    run: () => {
      const applied = applySpeakerMap(turns, { ...MAP, 'Speaker 3': { role: 'ignore' } }, 'Arjun Mehta');
      return { ok: applied.length === 4 && applied.every((t) => t.sourceLabel !== 'Speaker 3'), detail: `${applied.length} turns` };
    },
  },
  {
    name: 'tags every evaluator line as CANDIDATE or PANEL',
    run: () => {
      const text = buildRoleTaggedTranscript(applySpeakerMap(turns, MAP, 'Arjun Mehta'));
      const lines = text.split('\n');
      const ok = lines.length === 5
        && lines[1].includes('CANDIDATE (Arjun Mehta):')
        && lines[0].includes('PANEL (Priya Sharma):')
        && lines.every((l) => /CANDIDATE \(|PANEL \(/.test(l));
      return { ok, detail: text };
    },
  },
  {
    name: 'keeps confirmed assignments when a clip is appended, uses suggestions for new voices',
    run: () => {
      const suggested: SpeakerMap = {
        'Speaker 2': { role: 'panelist', suggested: true },
        'Speaker 4': { role: 'ignore', suggested: true },
      };
      const merged = mergeSpeakerMaps(MAP, suggested, ['Speaker 1', 'Speaker 2', 'Speaker 4']);
      const ok = merged['Speaker 2'].role === 'candidate' && merged['Speaker 4'].role === 'ignore' && !('Speaker 3' in merged);
      return { ok, detail: JSON.stringify(merged) };
    },
  },
  {
    name: 'does not treat a real transcript mentioning "inaudible" as no speech',
    run: () => {
      const text = `${ROOM_TRANSCRIPT}\n[00:00:50] Speaker 2: [inaudible] — sorry, I said we would use lineage for governance.`;
      return { ok: !isTranscriptEmptyOrNoSpeech(text) };
    },
  },
  {
    name: 'still treats a bare no-speech marker as no speech',
    run: () => ({ ok: isTranscriptEmptyOrNoSpeech('[No speech detected in audio recording]') }),
  },
];
