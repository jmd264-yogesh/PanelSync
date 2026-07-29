/**
 * Hook for managing slot overlap calculation and selection
 */

import { useState, useMemo } from "react";
import { Interview } from "@server/lib/db";
import { calculateSlotOverlap, TimeSlot } from "@common/util/interviews/slotOverlapCalculation";

export interface UseSlotOverlapReturn {
  overlappingSlots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  selectSlot: (slot: TimeSlot | null) => void;
  clearSelection: () => void;
  hasOverlaps: boolean;
}

export function useSlotOverlap(interview: Interview): UseSlotOverlapReturn {
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Memoize slot calculation to avoid unnecessary recalculations
  const overlappingSlots = useMemo(() => {
    return calculateSlotOverlap(interview);
  }, [interview]);

  const selectSlot = (slot: TimeSlot | null) => {
    setSelectedSlot(slot);
  };

  const clearSelection = () => {
    setSelectedSlot(null);
  };

  const hasOverlaps = overlappingSlots.length > 0;

  return {
    overlappingSlots,
    selectedSlot,
    selectSlot,
    clearSelection,
    hasOverlaps,
  };
}
