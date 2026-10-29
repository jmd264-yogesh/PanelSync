// Cross-round visibility: L2 panelists may read L1 feedback; L1 panelists must never see
// anything from L2. These pin down the rule every cross-round route relies on.

import { canViewPriorRound, outcomeVisibleToRound } from '../src/lib/interview-role';

export interface VisibilityCase {
  name: string;
  run: () => { ok: boolean; detail?: string };
}

const eq = (got: unknown, want: unknown) => ({ ok: got === want, detail: `got ${String(got)}, expected ${String(want)}` });

export const VISIBILITY_CASES: VisibilityCase[] = [
  { name: 'L2 panelists can view L1 feedback', run: () => eq(canViewPriorRound('L2', 'L1'), true) },
  { name: 'L1 panelists cannot view L2 data', run: () => eq(canViewPriorRound('L1', 'L2'), false) },
  { name: 'an L1 panelist cannot view their own round through the prior-round route', run: () => eq(canViewPriorRound('L1', 'L1'), false) },
  { name: 'L2 panelists cannot use the prior-round route on L2 data', run: () => eq(canViewPriorRound('L2', 'L2'), false) },
  { name: 'General-round panelists get no cross-round access', run: () => eq(canViewPriorRound('GENERAL', 'L1'), false) },
  { name: 'L1 panelists see "passed L1" when the candidate later passed L2', run: () => eq(outcomeVisibleToRound('L1', 'PASSED_L2', 'PASSED'), 'PASSED_L1') },
  { name: 'L1 panelists see "passed L1" when the candidate was selected', run: () => eq(outcomeVisibleToRound('L1', 'SELECTED', 'PASSED'), 'PASSED_L1') },
  { name: 'an L2 rejection is not shown to an L1 panelist who passed the candidate', run: () => eq(outcomeVisibleToRound('L1', 'REJECTED', 'PASSED'), 'PENDING') },
  { name: 'an L1 rejection is still shown to the L1 panelist who made it', run: () => eq(outcomeVisibleToRound('L1', 'REJECTED', 'REJECTED'), 'REJECTED') },
  { name: 'L2 panelists see the full outcome', run: () => eq(outcomeVisibleToRound('L2', 'PASSED_L2', 'PASSED'), 'PASSED_L2') },
];
