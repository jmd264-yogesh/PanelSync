import { Interview } from "@server/lib/db";

/**
 * Calculate overlapping availability slots across all submitted panels.
 * Returns slots with minimum 30-minute gap between them.
 */
export function getOverlappingSlots(
  interview: Interview,
): { start: string; end: string }[] {
  const panels = interview.panels;
  if (!panels || panels.length === 0) return [];
  const activePanels = panels.filter((p) => p.status === "SUBMITTED");
  if (activePanels.length === 0) return [];

  const duration = interview.duration;
  const limitStart = new Date(interview.startDate);
  const limitEnd = new Date(interview.endDate);
  const intervalMin = 15;
  const chunkMs = intervalMin * 60 * 1000;
  const durationMs = duration * 60 * 1000;
  const startMs = limitStart.getTime();
  const endMs = limitEnd.getTime();
  const matches: { start: string; end: string }[] = [];

  for (let time = startMs; time + durationMs <= endMs; time += chunkMs) {
    const slotStart = new Date(time);
    const slotEnd = new Date(time + durationMs);
    const allAvailable = activePanels.every((panel) =>
      panel.availabilities.some((avail) => {
        const aS = new Date(avail.startTime).getTime();
        const aE = new Date(avail.endTime).getTime();
        return aS <= slotStart.getTime() && aE >= slotEnd.getTime();
      }),
    );
    if (allAvailable)
      matches.push({
        start: slotStart.toISOString(),
        end: slotEnd.toISOString(),
      });
  }

  return matches.filter((slot, idx) => {
    if (idx === 0) return true;
    const prev = matches[idx - 1];
    return (
      new Date(slot.start).getTime() - new Date(prev.start).getTime() >=
      30 * 60 * 1000
    );
  });
}
