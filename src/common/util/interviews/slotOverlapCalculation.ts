/**
 * Slot overlap calculation utility
 * Computes overlapping time slots across multiple panel availabilities
 */

import { Interview, InterviewPanel, PanelAvailability } from "@server/lib/db";

export interface TimeSlot {
  start: string;
  end: string;
}

export interface SlotOverlapResult {
  slot: TimeSlot;
  panelCount: number;
  panelNames: string[];
}

/**
 * Calculate overlapping time slots for an interview
 * Returns slots where all panels are available
 */
export function calculateSlotOverlap(interview: Interview): TimeSlot[] {
  const panels = interview.panels || [];
  const submittedPanels = panels.filter((p: InterviewPanel) => p.status === "SUBMITTED");

  if (submittedPanels.length === 0) {
    return [];
  }

  // Collect all availabilities from submitted panels
  const allAvailabilities: PanelAvailability[] = [];
  submittedPanels.forEach((panel: InterviewPanel) => {
    if (panel.availabilities && panel.availabilities.length > 0) {
      allAvailabilities.push(...panel.availabilities);
    }
  });

  if (allAvailabilities.length === 0) {
    return [];
  }

  // Group availabilities by time slot
  const slotMap = new Map<string, Set<string>>();

  allAvailabilities.forEach((avail: PanelAvailability) => {
    const key = `${avail.startTime}|${avail.endTime}`;
    if (!slotMap.has(key)) {
      slotMap.set(key, new Set());
    }
    // Find which panel this availability belongs to
    const panel = submittedPanels.find((p: InterviewPanel) =>
      p.availabilities?.some(
        (a: PanelAvailability) =>
          a.startTime === avail.startTime && a.endTime === avail.endTime
      )
    );
    if (panel) {
      slotMap.get(key)!.add(panel.id);
    }
  });

  // Filter to only slots where ALL panels are available
  const overlappingSlots: TimeSlot[] = [];
  slotMap.forEach((panelIds, key) => {
    if (panelIds.size === submittedPanels.length) {
      const [start, end] = key.split("|");
      overlappingSlots.push({ start, end });
    }
  });

  return sortSlotsByTime(overlappingSlots);
}

/**
 * Find common slots across multiple availability arrays
 */
export function findCommonSlots(
  availabilitySets: PanelAvailability[][]
): TimeSlot[] {
  if (availabilitySets.length === 0) {
    return [];
  }

  if (availabilitySets.length === 1) {
    return availabilitySets[0].map((a) => ({
      start: a.startTime,
      end: a.endTime,
    }));
  }

  // Build a map of slot keys to count of panels
  const slotCounts = new Map<string, number>();
  const requiredCount = availabilitySets.length;

  availabilitySets.forEach((availabilities) => {
    const uniqueSlots = new Set<string>();
    availabilities.forEach((avail) => {
      uniqueSlots.add(`${avail.startTime}|${avail.endTime}`);
    });
    uniqueSlots.forEach((key) => {
      slotCounts.set(key, (slotCounts.get(key) || 0) + 1);
    });
  });

  const commonSlots: TimeSlot[] = [];
  slotCounts.forEach((count, key) => {
    if (count === requiredCount) {
      const [start, end] = key.split("|");
      commonSlots.push({ start, end });
    }
  });

  return sortSlotsByTime(commonSlots);
}

/**
 * Sort time slots chronologically
 */
export function sortSlotsByTime(slots: TimeSlot[]): TimeSlot[] {
  return [...slots].sort((a, b) => {
    const aStart = new Date(a.start).getTime();
    const bStart = new Date(b.start).getTime();
    if (aStart !== bStart) {
      return aStart - bStart;
    }
    return new Date(a.end).getTime() - new Date(b.end).getTime();
  });
}

/**
 * Get detailed overlap information including panel names
 */
export function getSlotOverlapDetails(
  interview: Interview
): SlotOverlapResult[] {
  const panels = interview.panels || [];
  const submittedPanels = panels.filter((p: InterviewPanel) => p.status === "SUBMITTED");

  if (submittedPanels.length === 0) {
    return [];
  }

  // Group availabilities by time slot with panel info
  const slotMap = new Map<
    string,
    { panelIds: Set<string>; panelNames: Set<string> }
  >();

  submittedPanels.forEach((panel: InterviewPanel) => {
    if (panel.availabilities && panel.availabilities.length > 0) {
      panel.availabilities.forEach((avail: PanelAvailability) => {
        const key = `${avail.startTime}|${avail.endTime}`;
        if (!slotMap.has(key)) {
          slotMap.set(key, { panelIds: new Set(), panelNames: new Set() });
        }
        const slotInfo = slotMap.get(key)!;
        slotInfo.panelIds.add(panel.id);
        slotInfo.panelNames.add(panel.name);
      });
    }
  });

  // Build result array with full details
  const results: SlotOverlapResult[] = [];
  slotMap.forEach((info, key) => {
    const [start, end] = key.split("|");
    results.push({
      slot: { start, end },
      panelCount: info.panelIds.size,
      panelNames: Array.from(info.panelNames),
    });
  });

  return results.sort((a, b) => {
    const aStart = new Date(a.slot.start).getTime();
    const bStart = new Date(b.slot.start).getTime();
    if (aStart !== bStart) {
      return aStart - bStart;
    }
    return new Date(a.slot.end).getTime() - new Date(b.slot.end).getTime();
  });
}
