// Cases for Teams transcript parsing and speaker attribution.
//
// The parser is the riskiest part of the transcript feature: it consumes text produced
// by someone else's system, in a format that varies between tenants and has changed
// before. These fixtures cover the shapes Teams actually emits, plus the malformed input
// that would otherwise silently drop half an interview.

import { analyseTranscript, attributeSpeakers, parseVtt } from '../src/lib/transcript';

export interface TranscriptCase {
  name: string;
  run: () => { ok: boolean; detail?: string };
}

const IDENTITY = {
  candidateName: 'Arjun Mehta',
  candidateEmail: 'arjun.mehta@external.com',
  panelistNames: ['Priya Sharma', 'Ben Okoro'],
};

// The canonical shape: cue number, timestamp line, <v Speaker>text</v>.
const TEAMS_VTT = `WEBVTT

1
00:00:03.120 --> 00:00:07.480
<v Priya Sharma>So walk me through how you would partition that fact table.</v>

2
00:00:08.000 --> 00:00:20.500
<v Arjun Mehta>I would start by looking at the query patterns rather than the data volume, because partitioning on a column nobody filters by just adds overhead.</v>

3
00:00:21.000 --> 00:00:25.000
<v Priya Sharma>Good. And if the filters are mostly on a low cardinality column?</v>

4
00:00:25.500 --> 00:00:40.000
<v Arjun Mehta>Then partitioning alone will not help much and I would look at clustering keys instead, or a composite approach.</v>
`;

function check(cond: boolean, detail: string) {
  return cond ? { ok: true } : { ok: false, detail };
}

export const TRANSCRIPT_CASES: TranscriptCase[] = [
  {
    name: 'parses standard Teams cues with inline speaker tags',
    run: () => {
      const segments = parseVtt(TEAMS_VTT);
      if (segments.length !== 4) return { ok: false, detail: `got ${segments.length} segments, expected 4` };
      if (segments[0].speaker !== 'Priya Sharma') {
        return { ok: false, detail: `speaker was ${JSON.stringify(segments[0].speaker)}` };
      }
      if (segments[0].startMs !== 3120 || segments[0].endMs !== 7480) {
        return { ok: false, detail: `timings were ${segments[0].startMs}-${segments[0].endMs}, expected 3120-7480` };
      }
      return check(
        !segments[0].text.includes('<v'),
        `voice tag leaked into text: ${segments[0].text}`,
      );
    },
  },
  {
    name: 'handles CRLF line endings and a BOM',
    run: () => {
      const segments = parseVtt('﻿' + TEAMS_VTT.replace(/\n/g, '\r\n'));
      return check(segments.length === 4, `got ${segments.length} segments, expected 4`);
    },
  },
  {
    name: 'accepts mm:ss timestamps as well as hh:mm:ss',
    run: () => {
      const segments = parseVtt('WEBVTT\n\n1\n01:02.500 --> 01:05.000\n<v Priya Sharma>Short form.</v>\n');
      if (segments.length !== 1) return { ok: false, detail: `got ${segments.length} segments` };
      return check(segments[0].startMs === 62500, `startMs was ${segments[0].startMs}, expected 62500`);
    },
  },
  {
    name: 'ignores cue settings trailing the end timestamp',
    run: () => {
      const segments = parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:02.000 align:start position:50%\n<v Ben Okoro>With settings.</v>\n');
      if (segments.length !== 1) return { ok: false, detail: `got ${segments.length} segments` };
      return check(segments[0].endMs === 2000, `endMs was ${segments[0].endMs}, expected 2000`);
    },
  },
  {
    name: 'skips NOTE and STYLE blocks without losing cues',
    run: () => {
      const vtt = 'WEBVTT\n\nNOTE This transcript was generated automatically.\n\nSTYLE\n::cue { color: white }\n\n1\n00:00:01.000 --> 00:00:02.000\n<v Priya Sharma>Real cue.</v>\n';
      const segments = parseVtt(vtt);
      return check(segments.length === 1, `got ${segments.length} segments, expected 1`);
    },
  },
  {
    name: 'drops a malformed cue but keeps the rest of the interview',
    run: () => {
      const vtt = TEAMS_VTT + '\n5\nnot-a-timestamp --> also-not\n<v Priya Sharma>Broken.</v>\n\n6\n00:01:00.000 --> 00:01:04.000\n<v Arjun Mehta>Still here.</v>\n';
      const segments = parseVtt(vtt);
      if (segments.length !== 5) return { ok: false, detail: `got ${segments.length} segments, expected 5 (4 good + 1 recovered)` };
      return check(
        segments[segments.length - 1].text === 'Still here.',
        `last segment was ${JSON.stringify(segments[segments.length - 1].text)}`,
      );
    },
  },
  {
    name: 'returns nothing for empty or whitespace input rather than throwing',
    run: () => {
      for (const input of ['', '   \n\n  ', 'WEBVTT\n']) {
        if (parseVtt(input).length !== 0) return { ok: false, detail: `non-empty result for ${JSON.stringify(input)}` };
      }
      return { ok: true };
    },
  },
  {
    name: 'strips the trailing GUID some tenants append to speaker names',
    run: () => {
      const segments = parseVtt('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\n<v Priya Sharma <8:orgid:abc-123>>Hello.</v>\n');
      if (segments.length !== 1) return { ok: false, detail: `got ${segments.length} segments` };
      return check(
        segments[0].speaker === 'Priya Sharma',
        `speaker was ${JSON.stringify(segments[0].speaker)}, expected "Priya Sharma"`,
      );
    },
  },

  // ── Attribution ───────────────────────────────────────────────────────────
  {
    name: 'labels the candidate and the panel correctly',
    run: () => {
      const attributed = attributeSpeakers(parseVtt(TEAMS_VTT), IDENTITY);
      const candidate = attributed.filter((s) => s.role === 'candidate');
      const panel = attributed.filter((s) => s.role === 'panelist');
      if (candidate.length !== 2) return { ok: false, detail: `candidate segments: ${candidate.length}, expected 2` };
      return check(panel.length === 2, `panel segments: ${panel.length}, expected 2`);
    },
  },
  {
    name: 'matches the candidate from their email when the display name differs',
    run: () => {
      const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\n<v arjun mehta>Joining as a guest.</v>\n';
      const attributed = attributeSpeakers(parseVtt(vtt), { candidateName: '', candidateEmail: 'arjun.mehta@external.com' });
      return check(attributed[0]?.role === 'candidate', `role was ${attributed[0]?.role}`);
    },
  },
  {
    name: 'matches a candidate rendered with a Guest suffix',
    run: () => {
      const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\n<v Arjun Mehta (Guest)>Hello.</v>\n';
      const attributed = attributeSpeakers(parseVtt(vtt), IDENTITY);
      return check(attributed[0]?.role === 'candidate', `role was ${attributed[0]?.role}`);
    },
  },
  {
    name: 'never labels a known panelist as the candidate',
    run: () => {
      // A panelist who happens to share the candidate's surname must still read as panel:
      // misattributing the panel inflates the candidate's talk share, which is the number
      // a reviewer would actually act on.
      const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\n<v Priya Mehta>Panel speaking.</v>\n';
      const attributed = attributeSpeakers(parseVtt(vtt), { ...IDENTITY, panelistNames: ['Priya Mehta'] });
      return check(attributed[0]?.role === 'panelist', `role was ${attributed[0]?.role}, expected panelist`);
    },
  },
  {
    name: 'marks an unrecognised speaker unknown rather than guessing',
    run: () => {
      const vtt = 'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\n<v Someone Else>Who is this.</v>\n';
      const attributed = attributeSpeakers(parseVtt(vtt), IDENTITY);
      return check(attributed[0]?.role === 'unknown', `role was ${attributed[0]?.role}`);
    },
  },

  // ── Analysis ──────────────────────────────────────────────────────────────
  {
    name: 'computes the candidate talk share from cue durations',
    run: () => {
      const analysis = analyseTranscript(TEAMS_VTT, IDENTITY);
      // Panel: 4360 + 4000 = 8360ms. Candidate: 12500 + 14500 = 27000ms. Total 35360ms.
      const expected = 27000 / 35360;
      if (analysis.candidateTalkShare === null) return { ok: false, detail: 'talk share was null' };
      return check(
        Math.abs(analysis.candidateTalkShare - expected) < 0.001,
        `share was ${analysis.candidateTalkShare.toFixed(4)}, expected ${expected.toFixed(4)}`,
      );
    },
  },
  {
    name: 'reports talk share as null when no speaker matches the candidate',
    run: () => {
      const analysis = analyseTranscript(TEAMS_VTT, { candidateName: 'Nobody Here' });
      return check(
        analysis.candidateTalkShare === null,
        `share was ${analysis.candidateTalkShare}, expected null so the UI can say it is unavailable`,
      );
    },
  },
  {
    name: 'aggregates per-speaker stats that sum to the whole transcript',
    run: () => {
      const analysis = analyseTranscript(TEAMS_VTT, IDENTITY);
      if (analysis.speakers.length !== 2) return { ok: false, detail: `speakers: ${analysis.speakers.length}, expected 2` };
      const summedShare = analysis.speakers.reduce((sum, s) => sum + s.shareOfTime, 0);
      if (Math.abs(summedShare - 1) > 0.001) return { ok: false, detail: `shares summed to ${summedShare}` };
      const summedWords = analysis.speakers.reduce((sum, s) => sum + s.words, 0);
      return check(summedWords === analysis.totalWords, `word totals disagree: ${summedWords} vs ${analysis.totalWords}`);
    },
  },
  {
    name: 'handles an empty transcript without dividing by zero',
    run: () => {
      const analysis = analyseTranscript('', IDENTITY);
      return check(
        analysis.segments.length === 0
          && analysis.totalWords === 0
          && analysis.candidateTalkShare === null
          && analysis.speakers.length === 0,
        `unexpected analysis: ${JSON.stringify(analysis)}`,
      );
    },
  },
];
