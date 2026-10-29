// Round (L1 / L2) detection from the free-text `interviews.role`. Several files used to
// re-derive this with raw substring tests, which disagreed on roles like
// "L1 - Round 1 - L2 Support Engineer" and mislabelled lateral interviews as campus.

import { getInterviewInfo, parseRound } from '../src/lib/interview-role';

export interface RoundCase {
  name: string;
  run: () => { ok: boolean; detail?: string };
}

const eq = (got: unknown, want: unknown) => ({ ok: got === want, detail: `got ${String(got)}, expected ${String(want)}` });

export const ROUND_CASES: RoundCase[] = [
  { name: 'reads L1 from a campus panelist-first role', run: () => eq(parseRound('L1 Interview - NIT Trichy'), 'L1') },
  { name: 'reads L2 from a manual-create role', run: () => eq(parseRound('L2 - Data Engineer'), 'L2') },
  { name: 'reads the round from a lateral role with a round label', run: () => eq(parseRound('L2 - Technical Round - Senior Data Engineer'), 'L2') },
  { name: 'uses the leading round, not an "L2" inside the position title', run: () => eq(parseRound('L1 - Round 1 - L2 Support Engineer'), 'L1') },
  { name: 'uses the leading round, not an "L1" inside the college name', run: () => eq(parseRound('L2 Interview - L1 Institute of Technology'), 'L2') },
  { name: 'is not fooled by letters inside other words', run: () => eq(parseRound('General - XL1 Platform'), 'GENERAL') },
  { name: 'treats a role with no round as General', run: () => eq(parseRound('General Interview - Pune University'), 'GENERAL') },
  { name: 'still reads an unprefixed legacy role by whole word', run: () => eq(parseRound('Data Engineer (L2)'), 'L2') },
  { name: 'strips a legacy "Lateral - " prefix before reading the round', run: () => eq(parseRound('Lateral - L1 - Data Engineer'), 'L1') },
  {
    name: 'classifies by the stored hiring type, not the role text',
    run: () => {
      const info = getInterviewInfo('L1 - Round 1 - Senior Data Engineer', 'LATERAL');
      return { ok: info.isLateral && !info.isCampus && info.isL1 };
    },
  },
  {
    name: 'a lateral role with no "Lateral - " prefix is lateral when hiringType says so',
    run: () => eq(getInterviewInfo('L2 - Architect', 'LATERAL').hiringType, 'LATERAL'),
  },
];
