// Panelist workload analytics for the scheduling flows.
//
// Purpose: make "who is being called too much, and who is being forgotten" visible at
// the moment a recruiter picks a panel, rather than something you only notice when
// someone complains. Pure functions over data the dashboard already holds — no new
// queries, no new endpoints.

import type { Interview, Panelist } from './db';

export type LoadBand = 'none' | 'light' | 'moderate' | 'heavy';

export interface WeekBucket {
  /** ISO date of the Monday starting this week. */
  weekStart: string;
  /** Short display label, e.g. "3 Feb". */
  label: string;
  assigned: number;
  conducted: number;
}

export interface PanelistLoad {
  panelistId: string;
  displayName: string;
  email: string;
  roles: ('L1' | 'L2')[];
  /** Panels they are on the hook for in the window (declines excluded). */
  totalAssigned: number;
  /** Of those, the ones that actually happened. */
  totalConducted: number;
  /** Most recent interview date in the window, or null if none. */
  lastInterviewAt: string | null;
  daysSinceLast: number | null;
  weeks: WeekBucket[];
  /** Assigned count relative to the average across all panelists (1 = exactly average). */
  vsAverage: number;
  /** 0..1 against the busiest panelist — drives heatmap cell intensity. */
  intensity: number;
  band: LoadBand;
}

export interface LoadOptions {
  /** How many trailing weeks to analyse, including the current one. */
  weeks?: number;
  now?: Date;
  /** Restrict to one hiring track, so campus load does not distort lateral picking. */
  hiringType?: 'CAMPUS' | 'LATERAL';
  /** Restrict to panelists carrying this designation. */
  round?: 'L1' | 'L2' | null;
}

const DAY_MS = 86_400_000;

/** Monday 00:00 of the week containing `date`, in local time. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0=Sun..6=Sat. Shift so Monday is the first day of the week.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * When an interview counts as "happening" for load purposes: the booked slot if one
 * exists, otherwise the proposed window's start — a pending interview is still a
 * commitment on the panelist's plate, not free capacity.
 */
export function interviewLoadDate(interview: Interview): Date | null {
  const raw = interview.scheduledSlotStart || interview.startDate || interview.createdAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computePanelistLoads(
  panelists: Panelist[],
  interviews: Interview[],
  options: LoadOptions = {},
): PanelistLoad[] {
  const { weeks = 8, now = new Date(), hiringType, round = null } = options;

  const currentWeekStart = startOfWeek(now);
  const windowStart = new Date(currentWeekStart.getTime() - (weeks - 1) * 7 * DAY_MS);

  // Week buckets, oldest first, so the heatmap reads left-to-right chronologically.
  const buckets: Date[] = Array.from(
    { length: weeks },
    (_, i) => new Date(windowStart.getTime() + i * 7 * DAY_MS),
  );
  const bucketIndex = new Map(buckets.map((d, i) => [isoDate(d), i]));

  const scoped = panelists.filter((p) => (round ? p.roles.includes(round) : true));

  const relevant = interviews.filter((i) => {
    if (i.status === 'CANCELLED') return false;
    if (hiringType && i.hiringType !== hiringType) return false;
    const date = interviewLoadDate(i);
    return date !== null && date >= windowStart;
  });

  const loads: PanelistLoad[] = scoped.map((panelist) => {
    const weekBuckets: WeekBucket[] = buckets.map((d) => ({
      weekStart: isoDate(d),
      label: weekLabel(d),
      assigned: 0,
      conducted: 0,
    }));

    let totalAssigned = 0;
    let totalConducted = 0;
    let lastInterviewAt: Date | null = null;

    for (const interview of relevant) {
      // Match on both id and email: panels created from a Graph search carry the Graph
      // user id, but directory-sourced ones can differ in casing or be re-created, and
      // email is the stable identity across both paths.
      const onPanel = interview.panels.some(
        (p) =>
          p.status !== 'REJECTED'
          && (p.userId === panelist.id || p.email.toLowerCase() === panelist.email.toLowerCase()),
      );
      if (!onPanel) continue;

      const date = interviewLoadDate(interview);
      if (!date) continue;
      const idx = bucketIndex.get(isoDate(startOfWeek(date)));
      if (idx === undefined) continue;

      totalAssigned += 1;
      weekBuckets[idx].assigned += 1;

      const happened = interview.status === 'SCHEDULED' && date.getTime() <= now.getTime();
      if (happened) {
        totalConducted += 1;
        weekBuckets[idx].conducted += 1;
      }

      if (date.getTime() <= now.getTime() && (!lastInterviewAt || date > lastInterviewAt)) {
        lastInterviewAt = date;
      }
    }

    return {
      panelistId: panelist.id,
      displayName: panelist.displayName,
      email: panelist.email,
      roles: panelist.roles,
      totalAssigned,
      totalConducted,
      lastInterviewAt: lastInterviewAt ? lastInterviewAt.toISOString() : null,
      daysSinceLast: lastInterviewAt
        ? Math.floor((now.getTime() - lastInterviewAt.getTime()) / DAY_MS)
        : null,
      weeks: weekBuckets,
      vsAverage: 0,
      intensity: 0,
      band: 'none' as LoadBand,
    };
  });

  // Fairness is inherently relative: three interviews is heavy on a team that averages
  // one and unremarkable on a team that averages four. So bands come from the spread
  // within this cohort, not an absolute threshold.
  const counts = loads.map((l) => l.totalAssigned);
  const max = Math.max(0, ...counts);
  const average = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;

  for (const load of loads) {
    load.intensity = max > 0 ? load.totalAssigned / max : 0;
    load.vsAverage = average > 0 ? load.totalAssigned / average : 0;
    load.band = load.totalAssigned === 0
      ? 'none'
      : average === 0 || load.vsAverage <= 0.75
        ? 'light'
        : load.vsAverage <= 1.4
          ? 'moderate'
          : 'heavy';
  }

  return loads;
}

/** Least-loaded first, so the fair pick is the top pick. Ties broken by longest-idle. */
export function byFairnessThenName(a: PanelistLoad, b: PanelistLoad): number {
  if (a.totalAssigned !== b.totalAssigned) return a.totalAssigned - b.totalAssigned;
  const aIdle = a.daysSinceLast ?? Number.POSITIVE_INFINITY;
  const bIdle = b.daysSinceLast ?? Number.POSITIVE_INFINITY;
  if (aIdle !== bIdle) return bIdle - aIdle;
  return a.displayName.localeCompare(b.displayName);
}

export const BAND_STYLE: Record<LoadBand, { color: string; bg: string; label: string }> = {
  none: { color: 'var(--text-muted)', bg: 'transparent', label: 'Not called recently' },
  light: { color: 'var(--success, #16A34A)', bg: 'var(--success-glow, rgba(22,163,74,0.1))', label: 'Light load' },
  moderate: { color: 'var(--warning, #F59E0B)', bg: 'var(--warning-glow, rgba(245,158,11,0.1))', label: 'Moderate load' },
  heavy: { color: 'var(--danger, #DC2626)', bg: 'var(--danger-glow, rgba(220,38,38,0.1))', label: 'Heavy load' },
};
