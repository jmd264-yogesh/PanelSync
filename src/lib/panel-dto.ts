import type { Interview, InterviewPanel } from './db';

/**
 * The interview as one panelist may see it: only their own panel. Each panel carries a
 * secret link token (used to submit availability and feedback without logging in) plus
 * its owner's feedback and decision, so returning the whole `interview.panels` list to a
 * panelist let anyone with one link act as — and read the feedback of — their co-panelists.
 */
export function interviewForPanelist<T extends Interview>(interview: T, ownPanelId: string): T {
  return { ...interview, panels: interview.panels.filter((p: InterviewPanel) => p.id === ownPanelId) };
}
