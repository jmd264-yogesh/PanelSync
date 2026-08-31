// Cases for the panelist workload analytics.
//
// This drives a fairness decision a recruiter makes dozens of times a drive, so the
// counting rules need to be pinned down: a declined invite isn't load, a cancelled
// interview never happened, and campus volume shouldn't distort lateral picking.
// Dates are all expressed as offsets from a fixed `now`, so the suite behaves the same
// whichever weekday it runs on.

import type { Interview, InterviewPanel, Panelist } from '../src/lib/db';
import { startOfWeek } from '../src/lib/panelist-load';

export const NOW = new Date(2026, 2, 18, 12, 0, 0); // 18 Mar 2026, midday local
const DAY_MS = 86_400_000;

/** A date `weeksAgo` whole weeks before the current week, mid-week to avoid boundaries. */
export function weeksAgo(n: number): string {
  const monday = startOfWeek(NOW);
  return new Date(monday.getTime() - n * 7 * DAY_MS + 2 * DAY_MS + 10 * 3_600_000).toISOString();
}

export const PANELISTS: Panelist[] = [
  { id: 'u-anita', displayName: 'Anita Rao', email: 'anita@acme.com', roles: ['L1'], createdAt: weeksAgo(20) },
  { id: 'u-ben', displayName: 'Ben Okoro', email: 'ben@acme.com', roles: ['L1', 'L2'], createdAt: weeksAgo(20) },
  { id: 'u-chen', displayName: 'Chen Wei', email: 'chen@acme.com', roles: ['L2'], createdAt: weeksAgo(20) },
  { id: 'u-dana', displayName: 'Dana Silva', email: 'dana@acme.com', roles: ['L1'], createdAt: weeksAgo(20) },
];

interface MakeInterviewArgs {
  id: string;
  panelEmails: string[];
  at: string;
  status?: Interview['status'];
  hiringType?: Interview['hiringType'];
  panelStatus?: InterviewPanel['status'];
  /** Simulates a panel row whose Graph id drifted from the directory record. */
  breakUserIds?: boolean;
}

export function makeInterview({
  id,
  panelEmails,
  at,
  status = 'SCHEDULED',
  hiringType = 'CAMPUS',
  panelStatus = 'SUBMITTED',
  breakUserIds = false,
}: MakeInterviewArgs): Interview {
  const panels: InterviewPanel[] = panelEmails.map((email, i) => {
    const panelist = PANELISTS.find((p) => p.email === email);
    return {
      id: `${id}-p${i}`,
      interviewId: id,
      userId: breakUserIds ? `stale-${i}` : (panelist?.id ?? `unknown-${i}`),
      name: panelist?.displayName ?? email,
      email,
      token: `${id}-t${i}`,
      status: panelStatus,
      availabilities: [],
    };
  });

  return {
    id,
    candidateName: `Candidate ${id}`,
    candidateEmail: `${id}@candidates.test`,
    role: 'L1 - Test College - Data Engineer',
    duration: 45,
    startDate: at,
    endDate: at,
    status,
    hiringType,
    scheduledSlotStart: status === 'SCHEDULED' ? at : undefined,
    createdAt: at,
    updatedAt: at,
    panels,
  };
}

export interface LoadCase {
  name: string;
  interviews: Interview[];
  options: { weeks?: number; hiringType?: 'CAMPUS' | 'LATERAL'; round?: 'L1' | 'L2' | null };
  /** Assertions keyed by panelist email. */
  expect: Record<string, { assigned?: number; conducted?: number; band?: string; daysSinceLast?: number | null }>;
  /** Emails expected to be present in the result, in this exact order. */
  expectOrder?: string[];
  /** Emails that must not appear at all (wrong designation). */
  expectAbsent?: string[];
}

export const LOAD_CASES: LoadCase[] = [
  {
    name: 'counts assignments per panelist inside the window',
    interviews: [
      makeInterview({ id: 'i1', panelEmails: ['anita@acme.com'], at: weeksAgo(1) }),
      makeInterview({ id: 'i2', panelEmails: ['anita@acme.com', 'dana@acme.com'], at: weeksAgo(2) }),
      makeInterview({ id: 'i3', panelEmails: ['anita@acme.com'], at: weeksAgo(3) }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: {
      'anita@acme.com': { assigned: 3, conducted: 3 },
      'dana@acme.com': { assigned: 1, conducted: 1 },
      'ben@acme.com': { assigned: 0, conducted: 0, daysSinceLast: null },
    },
  },
  {
    name: 'excludes interviews older than the window',
    interviews: [
      makeInterview({ id: 'old', panelEmails: ['anita@acme.com'], at: weeksAgo(20) }),
      makeInterview({ id: 'new', panelEmails: ['anita@acme.com'], at: weeksAgo(1) }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: { 'anita@acme.com': { assigned: 1 } },
  },
  {
    name: 'a declined invitation is not load',
    interviews: [
      makeInterview({ id: 'dec', panelEmails: ['anita@acme.com'], at: weeksAgo(1), panelStatus: 'REJECTED' }),
      makeInterview({ id: 'acc', panelEmails: ['anita@acme.com'], at: weeksAgo(1) }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: { 'anita@acme.com': { assigned: 1 } },
  },
  {
    name: 'a cancelled interview never happened',
    interviews: [
      makeInterview({ id: 'can', panelEmails: ['anita@acme.com'], at: weeksAgo(1), status: 'CANCELLED' }),
      makeInterview({ id: 'ok', panelEmails: ['anita@acme.com'], at: weeksAgo(1) }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: { 'anita@acme.com': { assigned: 1 } },
  },
  {
    name: 'a pending interview counts as assigned but not conducted',
    interviews: [
      makeInterview({ id: 'pend', panelEmails: ['anita@acme.com'], at: weeksAgo(1), status: 'PENDING' }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: { 'anita@acme.com': { assigned: 1, conducted: 0 } },
  },
  {
    name: 'scopes to one hiring track so campus volume does not distort lateral picking',
    interviews: [
      makeInterview({ id: 'c1', panelEmails: ['ben@acme.com'], at: weeksAgo(1), hiringType: 'CAMPUS' }),
      makeInterview({ id: 'c2', panelEmails: ['ben@acme.com'], at: weeksAgo(2), hiringType: 'CAMPUS' }),
      makeInterview({ id: 'l1', panelEmails: ['ben@acme.com'], at: weeksAgo(1), hiringType: 'LATERAL' }),
    ],
    options: { weeks: 6, hiringType: 'LATERAL', round: 'L2' },
    expect: { 'ben@acme.com': { assigned: 1 } },
  },
  {
    name: 'only surfaces panelists holding the round designation',
    interviews: [],
    options: { weeks: 6, round: 'L2' },
    expect: {},
    expectAbsent: ['anita@acme.com', 'dana@acme.com'],
  },
  {
    name: 'matches a panel row whose Graph id drifted, via email',
    interviews: [
      makeInterview({ id: 'drift', panelEmails: ['anita@acme.com'], at: weeksAgo(1), breakUserIds: true }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: { 'anita@acme.com': { assigned: 1 } },
  },
  {
    name: 'bands the over-used panelist heavy and the unused one none',
    interviews: [
      makeInterview({ id: 'h1', panelEmails: ['anita@acme.com'], at: weeksAgo(1) }),
      makeInterview({ id: 'h2', panelEmails: ['anita@acme.com'], at: weeksAgo(2) }),
      makeInterview({ id: 'h3', panelEmails: ['anita@acme.com'], at: weeksAgo(3) }),
      makeInterview({ id: 'h4', panelEmails: ['anita@acme.com'], at: weeksAgo(4) }),
      makeInterview({ id: 'l1', panelEmails: ['dana@acme.com'], at: weeksAgo(1) }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: {
      'anita@acme.com': { assigned: 4, band: 'heavy' },
      'dana@acme.com': { assigned: 1, band: 'light' },
      'ben@acme.com': { assigned: 0, band: 'none' },
    },
  },
  {
    name: 'orders least-used first so the fair pick leads',
    interviews: [
      makeInterview({ id: 'o1', panelEmails: ['anita@acme.com'], at: weeksAgo(1) }),
      makeInterview({ id: 'o2', panelEmails: ['anita@acme.com'], at: weeksAgo(2) }),
      makeInterview({ id: 'o3', panelEmails: ['dana@acme.com'], at: weeksAgo(1) }),
    ],
    options: { weeks: 6, round: 'L1' },
    expect: {},
    // ben (0) before dana (1) before anita (2)
    expectOrder: ['ben@acme.com', 'dana@acme.com', 'anita@acme.com'],
  },
  {
    name: 'reports days since the last interview',
    interviews: [
      makeInterview({ id: 'd1', panelEmails: ['anita@acme.com'], at: weeksAgo(2) }),
    ],
    options: { weeks: 6, round: 'L1' },
    // weeksAgo(2) sits 2 weeks + 2 days into that week at 10:00, and `now` is the same
    // weekday at 12:00 — exactly 14 days and 2 hours earlier, so the floor is 14. Pinned
    // precisely so any drift in the week-bucketing maths gets caught.
    expect: { 'anita@acme.com': { daysSinceLast: 14 } },
  },
];
