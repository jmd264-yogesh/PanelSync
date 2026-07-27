import { ProposedSlot } from '@/common/types/panelist';

/**
 * Generate time slots across a date range with specified time windows
 * @param startDate - Start date (ISO string)
 * @param endDate - End date (ISO string)
 * @param startTime - Start time (HH:MM format)
 * @param endTime - End time (HH:MM format)
 * @returns Array of proposed slots with 30-minute intervals
 */
export function generateSlotRange(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string
): ProposedSlot[] {
  const generated: ProposedSlot[] = [];

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const currentDay = new Date(startDate);
  const endDay = new Date(endDate);

  while (currentDay <= endDay) {
    const year = currentDay.getFullYear();
    const month = currentDay.getMonth();
    const date = currentDay.getDate();

    const dayStart = new Date(year, month, date, startH, startM, 0);
    const dayEnd = new Date(year, month, date, endH, endM, 0);

    let time = dayStart.getTime();
    const stepMs = 30 * 60 * 1000; // 30 minutes

    while (time + stepMs <= dayEnd.getTime()) {
      generated.push({
        startTime: new Date(time).toISOString(),
        endTime: new Date(time + stepMs).toISOString(),
        selected: true,
      });
      time += stepMs;
    }

    currentDay.setDate(currentDay.getDate() + 1);
  }

  return generated;
}

/**
 * Format a time slot for display
 * @param slot - Proposed slot
 * @returns Formatted string representation
 */
export function formatTimeSlot(slot: ProposedSlot): string {
  const start = new Date(slot.startTime);
  const end = new Date(slot.endTime);

  const dateStr = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const startTimeStr = start.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const endTimeStr = end.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${dateStr} @ ${startTimeStr} - ${endTimeStr} (IST)`;
}

/**
 * Get initials from a name for avatar display
 * @param name - Full name
 * @returns Two-letter initials in uppercase
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}
