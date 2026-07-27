import { useState, useEffect } from 'react';
import { ProposedSlot } from '@/common/types/panelist';
import { generateSlotRange } from '@/common/util/panelists/timeSlotGenerator';

interface UseSlotGeneratorParams {
  startDate: string;
  endDate: string;
  interviewType: 'L1' | 'L2' | 'General';
  l1TimeStart: string;
  l1TimeEnd: string;
  l2TimeStart: string;
  l2TimeEnd: string;
  isActive: boolean; // Only generate when active (modal is open)
}

export function useSlotGenerator({
  startDate,
  endDate,
  interviewType,
  l1TimeStart,
  l1TimeEnd,
  l2TimeStart,
  l2TimeEnd,
  isActive,
}: UseSlotGeneratorParams) {
  const [generatedSlots, setGeneratedSlots] = useState<ProposedSlot[]>([]);

  useEffect(() => {
    if (!isActive || !startDate || !endDate) {
      setGeneratedSlots([]);
      return;
    }

    const timingStart = interviewType === 'L1' ? l1TimeStart : l2TimeStart;
    const timingEnd = interviewType === 'L1' ? l1TimeEnd : l2TimeEnd;

    const slots = generateSlotRange(startDate, endDate, timingStart, timingEnd);
    setGeneratedSlots(slots);
  }, [startDate, endDate, interviewType, l1TimeStart, l1TimeEnd, l2TimeStart, l2TimeEnd, isActive]);

  const toggleSlot = (index: number) => {
    const updated = [...generatedSlots];
    updated[index].selected = !updated[index].selected;
    setGeneratedSlots(updated);
  };

  const setAllSlots = (selected: boolean) => {
    const updated = generatedSlots.map((s) => ({ ...s, selected }));
    setGeneratedSlots(updated);
  };

  const selectedSlots = generatedSlots.filter((s) => s.selected);

  return {
    generatedSlots,
    selectedSlots,
    toggleSlot,
    setAllSlots,
    setGeneratedSlots,
  };
}
