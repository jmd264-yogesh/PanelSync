/**
 * useSlotBooking Hook
 *
 * Manages state and actions for Flow A (Slot Nomination / Panelist-First Booking)
 * Handles slot selection, booking, and booked meetings display
 */

import { useState } from "react";
import { TimeSlot, BookedSlot } from "@/common/types/availability";
import { Interview, InterviewPanel } from "@server/lib/db";

interface UseSlotBookingProps {
  panel: InterviewPanel;
  interview: Interview;
}

interface UseSlotBookingReturn {
  // State
  selectedSlots: string[];
  bookedMeetings: BookedSlot[];
  isBooked: boolean;
  isBooking: boolean;
  hoveredSlotId: string | null;
  errorMsg: string;

  // Actions
  toggleSlotSelection: (slotId: string) => void;
  setHoveredSlotId: (slotId: string | null) => void;
  handleBookSelectedSlots: () => Promise<void>;
  setErrorMsg: (msg: string) => void;
}

export function useSlotBooking({
  panel,
  interview,
}: UseSlotBookingProps): UseSlotBookingReturn {
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [bookedMeetings, setBookedMeetings] = useState<BookedSlot[]>([]);
  const [isBooked, setIsBooked] = useState(interview.status === "SCHEDULED");
  const [isBooking, setIsBooking] = useState(false);
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const toggleSlotSelection = (slotId: string) => {
    setSelectedSlots((prev) =>
      prev.includes(slotId)
        ? prev.filter((id) => id !== slotId)
        : [...prev, slotId]
    );
  };

  const handleBookSelectedSlots = async () => {
    if (selectedSlots.length === 0) return;

    setIsBooking(true);
    setErrorMsg("");

    const slotsToBook = panel.availabilities
      .filter((a) => selectedSlots.includes(a.id))
      .map((a) => ({ startTime: a.startTime, endTime: a.endTime }));

    try {
      const res = await fetch("/api/availability/select-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: panel.token,
          slots: slotsToBook,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to book slots.");
      }

      const data = await res.json();
      setBookedMeetings(data.meetings || []);
      setIsBooked(true);
    } catch (err) {
      console.error(err);
      setErrorMsg(
        (err as Error).message ||
          "An error occurred while booking selected slots."
      );
    } finally {
      setIsBooking(false);
    }
  };

  return {
    selectedSlots,
    bookedMeetings,
    isBooked,
    isBooking,
    hoveredSlotId,
    errorMsg,
    toggleSlotSelection,
    setHoveredSlotId,
    handleBookSelectedSlots,
    setErrorMsg,
  };
}
