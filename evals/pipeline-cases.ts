// Cases for the lateral hiring pipeline stages.
//
// These exist because the stage list had silently drifted into three inconsistent
// shapes across the UI, the PATCH route and the type definition — three dropdown options
// were rejected with a 400, and one accepted value was never offered. The suite pins the
// two things that made that possible: one canonical list, and a safe read path for rows
// written under the old names.

import {
  LATERAL_STAGES,
  STAGE_LABEL,
  STAGE_STYLE,
  advanceStage,
  isLateralStage,
  normalizeStage,
  type LateralStage,
} from '../src/lib/lateral-pipeline';

export interface PipelineCase {
  name: string;
  run: () => { ok: boolean; detail?: string };
}

function expectEqual<T>(actual: T, expected: T, what: string) {
  return actual === expected
    ? { ok: true }
    : { ok: false, detail: `${what}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}` };
}

export const PIPELINE_CASES: PipelineCase[] = [
  {
    name: 'every stage has a human label and a badge style',
    run: () => {
      const missing = LATERAL_STAGES.filter((s) => !STAGE_LABEL[s] || !STAGE_STYLE[s]);
      return missing.length === 0
        ? { ok: true }
        : { ok: false, detail: `missing label/style for: ${missing.join(', ')}` };
    },
  },
  {
    name: 'the stage list is exactly the agreed pipeline',
    run: () => expectEqual(
      LATERAL_STAGES.join(','),
      'NEW,L1,L2,MANAGER,OFFERED,HIRED,REJECTED,WITHDRAWN',
      'stage order',
    ),
  },
  {
    name: 'rejects a value that is not a stage',
    run: () => {
      // The exact values the API used to accept or the UI used to offer.
      const retired = ['SCREENING', 'INTERVIEWING', 'WAITING_FOR_INTERVIEW', 'INTERVIEW_SCHEDULED', 'INTERVIEW_COMPLETED'];
      const leaked = retired.filter(isLateralStage);
      return leaked.length === 0
        ? { ok: true }
        : { ok: false, detail: `retired values still accepted: ${leaked.join(', ')}` };
    },
  },
  {
    name: 'normalises legacy rows to a sensible current stage',
    run: () => {
      const expected: Record<string, LateralStage> = {
        SCREENING: 'NEW',
        WAITING_FOR_INTERVIEW: 'NEW',
        INTERVIEW_SCHEDULED: 'L1',
        INTERVIEW_COMPLETED: 'L1',
        INTERVIEWING: 'L1',
      };
      for (const [legacy, want] of Object.entries(expected)) {
        const got = normalizeStage(legacy);
        if (got !== want) return { ok: false, detail: `${legacy} -> ${got}, expected ${want}` };
      }
      return { ok: true };
    },
  },
  {
    name: 'normalises unknown and empty values to NEW rather than throwing',
    run: () => {
      for (const input of [null, undefined, '', 'GARBAGE']) {
        const got = normalizeStage(input as string | null | undefined);
        if (got !== 'NEW') return { ok: false, detail: `${JSON.stringify(input)} -> ${got}, expected NEW` };
      }
      return { ok: true };
    },
  },
  {
    name: 'passes current stages through normalisation untouched',
    run: () => {
      const changed = LATERAL_STAGES.filter((s) => normalizeStage(s) !== s);
      return changed.length === 0 ? { ok: true } : { ok: false, detail: `mutated: ${changed.join(', ')}` };
    },
  },

  // ── advanceStage ──────────────────────────────────────────────────────────
  {
    name: 'scheduling an L1 moves a new candidate to L1',
    run: () => expectEqual(advanceStage('NEW', 'L1'), 'L1', 'NEW + L1'),
  },
  {
    name: 'scheduling an L2 moves an L1 candidate to L2',
    run: () => expectEqual(advanceStage('L1', 'L2'), 'L2', 'L1 + L2'),
  },
  {
    name: 're-running an earlier round does not demote the candidate',
    run: () => {
      const a = advanceStage('MANAGER', 'L1');
      if (a !== 'MANAGER') return { ok: false, detail: `MANAGER + L1 -> ${a}, expected MANAGER` };
      const b = advanceStage('L2', 'L1');
      if (b !== 'L2') return { ok: false, detail: `L2 + L1 -> ${b}, expected L2` };
      return { ok: true };
    },
  },
  {
    name: 'scheduling against a finished outcome never revives it',
    run: () => {
      for (const terminal of ['HIRED', 'REJECTED', 'WITHDRAWN'] as LateralStage[]) {
        const got = advanceStage(terminal, 'L2');
        if (got !== terminal) return { ok: false, detail: `${terminal} + L2 -> ${got}, expected ${terminal}` };
      }
      return { ok: true };
    },
  },
  {
    name: 'does not drag an offered candidate back into a round',
    run: () => expectEqual(advanceStage('OFFERED', 'L2'), 'OFFERED', 'OFFERED + L2'),
  },
];
